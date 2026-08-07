import {
  createStudyProcessingRESTRepository,
  StudyReprocessRESTError,
  type StudyProcessingRESTRepository,
} from './restRepository';
import type { CreatedStudyProcessingRun } from './types';

export interface StudyReprocessTransport {
  reprocessStudy(studyInstanceUID: string): Promise<CreatedStudyProcessingRun>;
}

export class StudyReprocessError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'StudyReprocessError';
    this.status = status;
  }
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
