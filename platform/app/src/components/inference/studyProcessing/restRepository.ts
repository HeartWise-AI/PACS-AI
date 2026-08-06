import Api from '../../../pacsAPIAxios';
import {
  mapProcessingRun,
  mapStudyProcessingRunHistory,
  mapWorklistStudyStatusPage,
} from './restMapper';
import type {
  ProcessingRunDetailDTO,
  StudyProcessingRunHistoryPageDTO,
  WorklistAPIResponse,
  WorklistStudyStatusPageDTO,
} from './restDTO';
import type { ProcessingRun, StudyProcessingRunHistory, StudyProcessingSummary } from './types';

export const DEFAULT_STUDY_PROCESSING_PAGE_SIZE = 25;
export const MAX_STUDY_PROCESSING_PAGE_SIZE = 100;

interface HTTPResponse<T> {
  data: T;
}

export interface StudyProcessingHTTPClient {
  get<T>(url: string, config?: { params?: URLSearchParams }): Promise<HTTPResponse<T>>;
}

export interface StudyProcessingPageRequest {
  limit?: number;
  offset?: number;
}

export interface WorklistStudyStatusRequest extends StudyProcessingPageRequest {
  studyInstanceUIDs: string[];
}

export interface StudyProcessingRunHistoryRequest extends StudyProcessingPageRequest {
  studyInstanceUID: string;
}

export interface WorklistStudyStatusResult {
  summaries: StudyProcessingSummary[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface StudyProcessingRunHistoryResult {
  history: StudyProcessingRunHistory;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface StudyProcessingRESTRepository {
  loadWorklistStudyStatuses(
    request: WorklistStudyStatusRequest
  ): Promise<WorklistStudyStatusResult>;
  loadStudyProcessingRunHistory(
    request: StudyProcessingRunHistoryRequest
  ): Promise<StudyProcessingRunHistoryResult>;
  loadProcessingRunDetail(runId: string): Promise<ProcessingRun>;
}

export class StudyProcessingRESTError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'StudyProcessingRESTError';
    this.status = status;
  }
}

function normalizePageRequest(request: StudyProcessingPageRequest): {
  limit: number;
  offset: number;
} {
  const limit = request.limit ?? DEFAULT_STUDY_PROCESSING_PAGE_SIZE;
  const offset = request.offset ?? 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_STUDY_PROCESSING_PAGE_SIZE) {
    throw new StudyProcessingRESTError(
      `Processing status page size must be between 1 and ${MAX_STUDY_PROCESSING_PAGE_SIZE}.`,
      400
    );
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new StudyProcessingRESTError('Processing status page offset cannot be negative.', 400);
  }

  return { limit, offset };
}

function createPaginationParams(request: StudyProcessingPageRequest): URLSearchParams {
  const { limit, offset } = normalizePageRequest(request);
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return params;
}

function normalizeVisibleStudyInstanceUIDs(studyInstanceUIDs: string[]): string[] {
  const normalized = [...new Set(studyInstanceUIDs.map(uid => uid.trim()).filter(Boolean))];

  if (normalized.length === 0) {
    throw new StudyProcessingRESTError(
      'At least one visible Study Instance UID is required for a worklist status request.',
      400
    );
  }

  return normalized;
}

function requiredPathIdentifier(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new StudyProcessingRESTError(`${label} is required.`, 400);
  }

  return encodeURIComponent(normalized);
}

function responseStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return null;
  }

  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : null;
}

function safeRESTError(error: unknown): StudyProcessingRESTError {
  if (error instanceof StudyProcessingRESTError) {
    return error;
  }

  const status = responseStatus(error);
  const messageByStatus: Record<number, string> = {
    400: 'The processing status request was invalid.',
    401: 'Authentication is required to load processing status.',
    403: 'You do not have permission to view processing status.',
    404: 'The requested processing information was not found.',
    500: 'The processing status service encountered an error.',
    503: 'The processing status service is temporarily unavailable.',
  };

  return new StudyProcessingRESTError(
    (status && messageByStatus[status]) || 'Unable to load processing status.',
    status
  );
}

async function getResponseData<T>(
  client: StudyProcessingHTTPClient,
  path: string,
  params?: URLSearchParams
): Promise<T> {
  try {
    const response = await client.get<WorklistAPIResponse<T>>(
      path,
      params ? { params } : undefined
    );

    if (!response.data.success) {
      throw new StudyProcessingRESTError('Unable to load processing status.', null);
    }

    return response.data.data;
  } catch (error: unknown) {
    throw safeRESTError(error);
  }
}

export function createStudyProcessingRESTRepository(
  client: StudyProcessingHTTPClient = Api() as StudyProcessingHTTPClient
): StudyProcessingRESTRepository {
  return {
    async loadWorklistStudyStatuses(
      request: WorklistStudyStatusRequest
    ): Promise<WorklistStudyStatusResult> {
      const params = createPaginationParams(request);
      normalizeVisibleStudyInstanceUIDs(request.studyInstanceUIDs).forEach(studyInstanceUID => {
        params.append('studyInstanceUID', studyInstanceUID);
      });

      const page = await getResponseData<WorklistStudyStatusPageDTO>(
        client,
        '/v1/inference/worklist/status',
        params
      );
      return mapWorklistStudyStatusPage(page);
    },

    async loadStudyProcessingRunHistory(
      request: StudyProcessingRunHistoryRequest
    ): Promise<StudyProcessingRunHistoryResult> {
      const studyInstanceUID = requiredPathIdentifier(
        request.studyInstanceUID,
        'Study Instance UID'
      );
      const page = await getResponseData<StudyProcessingRunHistoryPageDTO>(
        client,
        `/v1/inference/worklist/studies/${studyInstanceUID}/runs`,
        createPaginationParams(request)
      );
      return mapStudyProcessingRunHistory(request.studyInstanceUID.trim(), page);
    },

    async loadProcessingRunDetail(runId: string): Promise<ProcessingRun> {
      const encodedRunId = requiredPathIdentifier(runId, 'Processing run ID');
      const run = await getResponseData<ProcessingRunDetailDTO>(
        client,
        `/v1/inference/processing/runs/${encodedRunId}`
      );
      return mapProcessingRun(run);
    },
  };
}
