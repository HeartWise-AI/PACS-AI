import Api from '../../pacsAPIAxios';
import type {
  PredictionExam,
  PredictionExecution,
  PredictionHistoryPage,
  PredictionLauncher,
  PredictionModel,
  PredictionsPage,
  PredictionState,
} from './types';

interface HTTPResponse<T> {
  data: T;
  headers?: Record<string, unknown>;
}

export interface PredictionsHTTPClient {
  get<T>(
    url: string,
    config?: {
      params?: Record<string, string>;
      responseType?: 'text';
      transformResponse?: (data: unknown) => unknown;
    }
  ): Promise<HTTPResponse<T>>;
}

export class PredictionsRequestError extends Error {
  readonly status: number | null;
  readonly errorCode: string | null;

  constructor(message: string, status: number | null, errorCode: string | null = null) {
    super(message);
    this.name = 'PredictionsRequestError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

const STATES: readonly PredictionState[] = [
  'waiting',
  'queued',
  'stalled',
  'running',
  'completed',
  'failed',
  'skipped',
  'cancelled',
  'expired',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function requestError(error: unknown, message: string): PredictionsRequestError {
  if (error instanceof PredictionsRequestError) {
    return error;
  }
  const response = isRecord(error) && isRecord(error.response) ? error.response : null;
  const status = typeof response?.status === 'number' ? response.status : null;
  const body = isRecord(response?.data) ? response.data : null;
  return new PredictionsRequestError(message, status, text(body?.errorCode));
}

function unwrap(body: unknown, message: string): unknown {
  if (isRecord(body) && typeof body.success === 'boolean') {
    if (!body.success) {
      throw new PredictionsRequestError(message, null, text(body.errorCode));
    }
    return body.data;
  }
  return body;
}

export function mapPredictionExecution(value: unknown): PredictionExecution | null {
  if (
    !isRecord(value) ||
    !text(value.runId) ||
    !text(value.executionId) ||
    !text(value.modelName)
  ) {
    return null;
  }
  const state = STATES.find(candidate => candidate === value.state) ?? 'queued';
  const skipReason =
    isRecord(value.skipReason) && text(value.skipReason.code)
      ? { code: String(value.skipReason.code), message: text(value.skipReason.message) }
      : null;
  return {
    runId: String(value.runId),
    executionId: String(value.executionId),
    runNumber: count(value.runNumber),
    trigger: text(value.trigger) ?? 'AUTO',
    requestedByUserId: text(value.requestedByUserId),
    requestedByName: text(value.requestedByName),
    requestedByYou: value.requestedByYou === true,
    modelName: String(value.modelName),
    modelVersion: text(value.modelVersion),
    modality: text(value.modality),
    state,
    status: text(value.status) ?? state,
    errorMessage: text(value.errorMessage),
    skipReason,
    cancellable: value.cancellable === true,
    cancelledAt: text(value.cancelledAt),
    runCreatedAt: text(value.runCreatedAt) ?? text(value.createdAt) ?? '',
    createdAt: text(value.createdAt) ?? '',
    updatedAt: text(value.updatedAt) ?? '',
    startedAt: text(value.startedAt),
    completedAt: text(value.completedAt),
    durationSeconds:
      typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds)
        ? value.durationSeconds
        : null,
  };
}

function mapLauncher(value: unknown): PredictionLauncher | null {
  if (!isRecord(value) || (value.kind !== 'automatic' && value.kind !== 'user')) {
    return null;
  }
  return {
    kind: value.kind,
    trigger: text(value.trigger) ?? 'AUTO',
    userId: text(value.userId),
    name: text(value.name),
    you: value.you === true,
    runs: count(value.runs),
    firstAt: text(value.firstAt) ?? '',
  };
}

export function mapPredictionExam(value: unknown): PredictionExam | null {
  if (!isRecord(value) || !text(value.studyInstanceUID)) {
    return null;
  }
  const counts = isRecord(value.counts) ? value.counts : {};
  const models = (Array.isArray(value.models) ? value.models : [])
    .map(model => {
      const execution = mapPredictionExecution(model);
      return execution
        ? ({
            ...execution,
            earlierRuns: count(isRecord(model) ? model.earlierRuns : 0),
          } as PredictionModel)
        : null;
    })
    .filter((model): model is PredictionModel => model !== null);
  return {
    studyInstanceUID: String(value.studyInstanceUID),
    patientId: text(value.patientId),
    accessionNumber: text(value.accessionNumber),
    modalitiesInStudy: text(value.modalitiesInStudy),
    studyDate: text(value.studyDate),
    lastActivityAt: text(value.lastActivityAt) ?? '',
    active: value.active === true,
    counts: {
      total: count(counts.total) || models.length,
      waiting: count(counts.waiting),
      queued: count(counts.queued),
      running: count(counts.running),
      completed: count(counts.completed),
      failed: count(counts.failed),
      skipped: count(counts.skipped),
      cancelled: count(counts.cancelled),
      stalled: count(counts.stalled),
      expired: count(counts.expired),
    },
    models,
    launchers: (Array.isArray(value.launchers) ? value.launchers : [])
      .map(mapLauncher)
      .filter((launcher): launcher is PredictionLauncher => launcher !== null),
  };
}

export function mapPredictionsPage(value: unknown): PredictionsPage {
  if (!isRecord(value) || !Array.isArray(value.exams)) {
    throw new PredictionsRequestError('The AI predictions response is invalid.', null);
  }
  const view = value.view === 'automatic' || value.view === 'all' ? value.view : 'mine';
  return {
    view,
    exams: value.exams
      .map(mapPredictionExam)
      .filter((exam): exam is PredictionExam => exam !== null),
    limit: count(value.limit),
    offset: count(value.offset),
    total: count(value.total),
    hasMore: value.hasMore === true,
    canViewAll: value.canViewAll === true,
  };
}

export interface PredictionsCSVExport {
  text: string;
  fileName: string;
  truncated: boolean;
}

function header(headers: Record<string, unknown> | undefined, name: string): string | null {
  if (!headers) {
    return null;
  }
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name);
  return key ? text(headers[key]) : null;
}

export function exportFileName(contentDisposition: string | null, now: Date): string {
  const match = contentDisposition ? /filename="([^"\\/]+\.csv)"/.exec(contentDisposition) : null;
  if (match) {
    return match[1];
  }
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
  return `ai-predictions-${stamp}.csv`;
}

export interface PredictionsRepository {
  listPredictions(params: Record<string, string>): Promise<PredictionsPage>;
  loadModelHistory(studyInstanceUID: string, modelName: string): Promise<PredictionHistoryPage>;
  exportCSV(params: Record<string, string>): Promise<PredictionsCSVExport>;
}

export function createPredictionsRepository(
  client: PredictionsHTTPClient = Api() as unknown as PredictionsHTTPClient,
  now: () => Date = () => new Date()
): PredictionsRepository {
  return {
    async listPredictions(params) {
      try {
        const response = await client.get<unknown>('/v1/inference/predictions', { params });
        return mapPredictionsPage(unwrap(response.data, 'Unable to load AI predictions.'));
      } catch (error: unknown) {
        throw requestError(error, 'Unable to load AI predictions.');
      }
    },

    async loadModelHistory(studyInstanceUID, modelName) {
      const path = `/v1/inference/predictions/${encodeURIComponent(studyInstanceUID.trim())}/history`;
      try {
        const response = await client.get<unknown>(path, { params: { model: modelName } });
        const body = unwrap(response.data, 'Unable to load the earlier runs.');
        const executions = isRecord(body) && Array.isArray(body.executions) ? body.executions : [];
        return {
          studyInstanceUID,
          modelName,
          executions: executions
            .map(mapPredictionExecution)
            .filter((execution): execution is PredictionExecution => execution !== null),
          hasMore: isRecord(body) && body.hasMore === true,
        };
      } catch (error: unknown) {
        throw requestError(error, 'Unable to load the earlier runs.');
      }
    },

    async exportCSV(params) {
      try {
        const response = await client.get<unknown>('/v1/inference/predictions/export.csv', {
          params,
          responseType: 'text',
          // Keep the body as text: axios would otherwise try JSON.
          transformResponse: data => data,
        });
        if (typeof response.data !== 'string') {
          throw new PredictionsRequestError('The export is empty.', null);
        }
        return {
          text: response.data,
          fileName: exportFileName(header(response.headers, 'content-disposition'), now()),
          truncated: header(response.headers, 'x-export-truncated') === 'true',
        };
      } catch (error: unknown) {
        throw requestError(error, 'Unable to export AI predictions.');
      }
    },
  };
}
