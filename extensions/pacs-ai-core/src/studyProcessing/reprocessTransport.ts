import {
  createStudyProcessingRESTRepository,
  StudyReprocessRESTError,
  type StudyProcessingRESTRepository,
} from './restRepository';
import type { BulkStudyReprocessResponse, CreatedStudyProcessingRun } from './types';

export interface StudyReprocessTransport {
  reprocessStudy(studyInstanceUID: string): Promise<CreatedStudyProcessingRun>;
}

export interface StudyBulkReprocessTransport {
  reprocessStudies(studyInstanceUIDs: string[]): Promise<BulkStudyReprocessResponse>;
}

export class StudyReprocessError extends Error {
  readonly status: number | null;
  readonly errorCode: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number | null,
    errorCode: string | null = null,
    retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = 'StudyReprocessError';
    this.status = status;
    this.errorCode = errorCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function createRESTStudyBulkReprocessTransport(
  repository: StudyProcessingRESTRepository = createStudyProcessingRESTRepository()
): StudyBulkReprocessTransport {
  return {
    async reprocessStudies(studyInstanceUIDs) {
      try {
        return await repository.reprocessStudies(studyInstanceUIDs);
      } catch (error: unknown) {
        if (error instanceof StudyReprocessRESTError) {
          throw new StudyReprocessError(error.message, error.status);
        }
        throw new StudyReprocessError('Unable to reprocess the selected studies.', null);
      }
    },
  };
}

export function bulkStudyReprocessError(
  errorCode: string,
  retryAfterSeconds: number | null
): StudyReprocessError {
  const presentationByCode: Record<string, { message: string; status: number }> = {
    INVALID_PAYLOAD: { message: 'The Study Instance UID is invalid.', status: 400 },
    MISSING_RECORD: {
      message: 'No processing candidates were found for this study.',
      status: 404,
    },
    DUPLICATE_RECORD: {
      message: 'This study already has an active processing run.',
      status: 409,
    },
    INFERENCE_QUOTA_EXCEEDED: {
      message: 'Inference allowance is exhausted.',
      status: 429,
    },
    INFERENCE_CONCURRENCY_EXCEEDED: {
      message: 'Too many inference executions are already active.',
      status: 429,
    },
    INFERENCE_QUEUE_LIMIT_EXCEEDED: {
      message: 'Too many processing runs are already queued.',
      status: 429,
    },
    INFERENCE_QUOTA_UNAVAILABLE: {
      message: 'Inference quota enforcement is temporarily unavailable.',
      status: 503,
    },
  };
  const presentation = presentationByCode[errorCode] ?? {
    message: 'The processing service could not create a new run.',
    status: 500,
  };

  return new StudyReprocessError(
    presentation.message,
    presentation.status,
    errorCode,
    retryAfterSeconds
  );
}

export interface StudyReprocessRequestCoordinator {
  isPending(studyInstanceUID: string): boolean;
  submit(studyInstanceUID: string): Promise<CreatedStudyProcessingRun>;
  clear(): void;
}

export function createRESTStudyReprocessTransport(
  repository: StudyProcessingRESTRepository = createStudyProcessingRESTRepository()
): StudyReprocessTransport {
  return {
    async reprocessStudy(studyInstanceUID) {
      try {
        return await repository.reprocessStudy(studyInstanceUID);
      } catch (error: unknown) {
        if (error instanceof StudyReprocessRESTError) {
          throw new StudyReprocessError(error.message, error.status);
        }
        throw new StudyReprocessError('Unable to reprocess this study.', null);
      }
    },
  };
}

export function createStudyReprocessRequestCoordinator(
  transport: StudyReprocessTransport
): StudyReprocessRequestCoordinator {
  let requestsByStudyInstanceUID = new Map<string, Promise<CreatedStudyProcessingRun>>();

  return {
    isPending: studyInstanceUID => requestsByStudyInstanceUID.has(studyInstanceUID),
    submit(studyInstanceUID) {
      const existingRequest = requestsByStudyInstanceUID.get(studyInstanceUID);
      if (existingRequest) {
        return existingRequest;
      }

      const request = transport.reprocessStudy(studyInstanceUID).finally(() => {
        if (requestsByStudyInstanceUID.get(studyInstanceUID) === request) {
          requestsByStudyInstanceUID.delete(studyInstanceUID);
        }
      });
      requestsByStudyInstanceUID.set(studyInstanceUID, request);
      return request;
    },
    clear() {
      requestsByStudyInstanceUID = new Map();
    },
  };
}
