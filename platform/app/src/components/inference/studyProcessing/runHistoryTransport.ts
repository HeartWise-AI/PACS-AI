import { createStudyProcessingRunHistoryFixture } from './runHistoryFixtureAdapter';
import type { StudyProcessingRunHistory, StudyProcessingSummary } from './types';

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
