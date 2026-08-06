import { createStudyProcessingRunHistoryFixture } from './runHistoryFixtureAdapter';
import {
  createStudyProcessingRESTRepository,
  StudyProcessingRESTError,
  type StudyProcessingRESTRepository,
} from './restRepository';
import type { StudyProcessingRunHistory, StudyProcessingSummary } from './types';

export const DEFAULT_RUN_HISTORY_PAGE_SIZE = 25;

export interface RunHistoryTransportResponse {
  history: StudyProcessingRunHistory;
  partial: boolean;
}

export interface StudyProcessingRunHistoryTransport {
  loadRunHistory: (studyInstanceUID: string) => Promise<RunHistoryTransportResponse>;
}

export class RunHistoryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunHistoryUnavailableError';
  }
}

export function createFixtureRunHistoryTransport(
  getStudySummary: (studyInstanceUID: string) => StudyProcessingSummary | undefined
): StudyProcessingRunHistoryTransport {
  return {
    async loadRunHistory(studyInstanceUID: string): Promise<RunHistoryTransportResponse> {
      const summary = getStudySummary(studyInstanceUID);

      return {
        history: summary
          ? createStudyProcessingRunHistoryFixture(summary)
          : { studyInstanceUID, runs: [] },
        partial: false,
      };
    },
  };
}

export function createRESTRunHistoryTransport(
  repository: StudyProcessingRESTRepository = createStudyProcessingRESTRepository()
): StudyProcessingRunHistoryTransport {
  return {
    async loadRunHistory(studyInstanceUID: string): Promise<RunHistoryTransportResponse> {
      try {
        const result = await repository.loadStudyProcessingRunHistory({
          studyInstanceUID,
          limit: DEFAULT_RUN_HISTORY_PAGE_SIZE,
          offset: 0,
        });

        return {
          history: result.history,
          partial: result.hasMore,
        };
      } catch (error: unknown) {
        if (
          error instanceof StudyProcessingRESTError &&
          (error.status === 403 || error.status === 404 || error.status === 503)
        ) {
          throw new RunHistoryUnavailableError(error.message);
        }

        throw error;
      }
    },
  };
}
