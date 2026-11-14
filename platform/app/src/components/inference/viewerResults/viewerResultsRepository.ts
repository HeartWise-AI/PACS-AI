import Api from '../../../pacsAPIAxios';
import type { SelectedView, ViewerModelResult, ViewerModelRun } from './types';

interface HTTPResponse<T> {
  data: T;
}

export interface ViewerResultsHTTPClient {
  get<T>(url: string): Promise<HTTPResponse<T>>;
  post<T>(url: string, body?: unknown): Promise<HTTPResponse<T>>;
}

export interface ViewerModelReport {
  htmlBase64: string;
  contentType: string;
}

export interface RunViewerModelRequest {
  studyInstanceUID: string;
  modelId: string;
  seriesInstanceUIDs?: string[];
}

export interface ViewerResultsRepository {
  loadLatestResults(studyInstanceUID: string): Promise<ViewerModelResult[]>;
  loadReport(result: ViewerModelResult): Promise<ViewerModelReport>;
  runModel(request: RunViewerModelRequest): Promise<ViewerModelRun>;
}

export class ViewerResultsRequestError extends Error {
  readonly status: number | null;
  readonly errorCode: string | null;

  constructor(message: string, status: number | null, errorCode: string | null = null) {
    super(message);
    this.name = 'ViewerResultsRequestError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

export const VIEWER_RESULTS_ERROR_CODES = {
  reportNotAvailable: 'REPORT_NOT_AVAILABLE',
  runAlreadyActive: 'RUN_ALREADY_ACTIVE',
} as const;

// A backend that predates the contract answers 404 (no route) or 501. The
// viewer then keeps its previous behaviour instead of surfacing an error.
export function isViewerResultsEndpointMissing(error: unknown): boolean {
  return (
    error instanceof ViewerResultsRequestError && (error.status === 404 || error.status === 501)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function encodedIdentifier(value: string | null | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new ViewerResultsRequestError(`${label} is required.`, 400);
  }
  return encodeURIComponent(normalized);
}

function requestError(error: unknown, fallbackMessage: string): ViewerResultsRequestError {
  if (error instanceof ViewerResultsRequestError) {
    return error;
  }

  const response = isRecord(error) && isRecord(error.response) ? error.response : null;
  const status = typeof response?.status === 'number' ? response.status : null;
  const body = isRecord(response?.data) ? response.data : null;
  const errorCode = optionalString(body?.errorCode);
  return new ViewerResultsRequestError(fallbackMessage, status, errorCode);
}

// api-pacs wraps most payloads as {success, message, data}; accept both the
// wrapped and the bare form so either backend style works.
function unwrap(body: unknown): unknown {
  if (isRecord(body) && typeof body.success === 'boolean' && 'data' in body) {
    if (!body.success) {
      throw new ViewerResultsRequestError(
        optionalString(body.message) ?? 'The request failed.',
        null,
        optionalString(body.errorCode)
      );
    }
    return body.data;
  }
  return body;
}

export function mapSelectedViews(value: unknown): SelectedView[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter(isRecord)
    .map((view, index) => ({
      sopInstanceUID: optionalString(view.sopInstanceUID),
      seriesInstanceUID: optionalString(view.seriesInstanceUID),
      viewLabel: optionalString(view.viewLabel),
      order: typeof view.order === 'number' && Number.isFinite(view.order) ? view.order : index,
      role: optionalString(view.role),
      extra: isRecord(view.extra) ? view.extra : null,
    }))
    .filter(view => view.sopInstanceUID || view.seriesInstanceUID)
    .sort((left, right) => left.order - right.order);
}

export function mapViewerModelResult(
  value: unknown,
  studyInstanceUID: string
): ViewerModelResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const modelName = optionalString(value.modelName);
  if (!modelName) {
    return null;
  }

  return {
    studyInstanceUID,
    modelName,
    modelVersion: optionalString(value.modelVersion),
    modality: optionalString(value.modality),
    modelId: optionalString(value.modelId),
    containerId: optionalString(value.containerId),
    runId: optionalString(value.runId),
    executionId: optionalString(value.executionId),
    studyServiceJobId: optionalString(value.studyServiceJobId),
    completedAt: optionalString(value.completedAt),
    trigger: optionalString(value.trigger),
    selectedViews: mapSelectedViews(value.selectedViews),
    reportAvailable: value.reportAvailable === true,
  };
}

function mapViewerModelRun(value: unknown): ViewerModelRun {
  const runId = isRecord(value) ? optionalString(value.runId) : null;
  if (!isRecord(value) || !runId) {
    throw new ViewerResultsRequestError('The run request returned an invalid response.', null);
  }

  return {
    runId,
    runNumber: typeof value.runNumber === 'number' ? value.runNumber : null,
    trigger: optionalString(value.trigger),
    executionId: optionalString(value.executionId),
    modelName: optionalString(value.modelName),
    modelVersion: optionalString(value.modelVersion),
  };
}

export function createViewerResultsRepository(
  client: ViewerResultsHTTPClient = Api() as ViewerResultsHTTPClient
): ViewerResultsRepository {
  return {
    async loadLatestResults(studyInstanceUID: string): Promise<ViewerModelResult[]> {
      const encodedStudyInstanceUID = encodedIdentifier(studyInstanceUID, 'Study Instance UID');
      let body: unknown;
      try {
        const response = await client.get<unknown>(
          `/v1/inference/worklist/studies/${encodedStudyInstanceUID}/latest-results`
        );
        body = unwrap(response.data);
      } catch (error: unknown) {
        throw requestError(error, 'Unable to load previous model results.');
      }

      const results = isRecord(body) && Array.isArray(body.results) ? body.results : [];
      return results
        .map(result => mapViewerModelResult(result, studyInstanceUID.trim()))
        .filter((result): result is ViewerModelResult => result !== null);
    },

    async loadReport(result: ViewerModelResult): Promise<ViewerModelReport> {
      const path =
        result.runId && result.executionId
          ? `/v1/inference/processing/runs/${encodedIdentifier(
              result.runId,
              'Processing run ID'
            )}/executions/${encodedIdentifier(result.executionId, 'Model execution ID')}/report`
          : `/v1/inference/worklist/studies/${encodedIdentifier(
              result.studyInstanceUID,
              'Study Instance UID'
            )}/jobs/${encodedIdentifier(result.studyServiceJobId, 'Study service job ID')}/report`;

      let body: unknown;
      try {
        const response = await client.get<unknown>(path);
        body = unwrap(response.data);
      } catch (error: unknown) {
        throw requestError(error, 'Unable to load the model report.');
      }

      const htmlBase64 = isRecord(body) ? optionalString(body.htmlBase64) : null;
      if (!htmlBase64) {
        throw new ViewerResultsRequestError('The model report is empty.', null);
      }
      return {
        htmlBase64,
        contentType: (isRecord(body) && optionalString(body.contentType)) || 'text/html',
      };
    },

    async runModel(request: RunViewerModelRequest): Promise<ViewerModelRun> {
      const path = `/v1/inference/worklist/studies/${encodedIdentifier(
        request.studyInstanceUID,
        'Study Instance UID'
      )}/models/${encodedIdentifier(request.modelId, 'Model ID')}/run`;
      const seriesInstanceUIDs = request.seriesInstanceUIDs?.filter(Boolean) ?? [];

      try {
        const response = await client.post<unknown>(
          path,
          seriesInstanceUIDs.length ? { seriesInstanceUIDs } : {}
        );
        return mapViewerModelRun(unwrap(response.data));
      } catch (error: unknown) {
        throw requestError(error, 'Unable to start the model run.');
      }
    },
  };
}
