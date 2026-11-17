import { createVisibleStudyProcessingFixtureSnapshot } from './fixtureAdapter';
import {
  createStudyProcessingRESTRepository,
  type StudyProcessingRESTRepository,
} from '@pacs-ai/extension-core/src/studyProcessing/restRepository';
import type { StudyProcessingSummary } from '@pacs-ai/extension-core/src/studyProcessing/types';

export interface StudyProcessingSnapshotTransport {
  loadVisibleStudySnapshot(studyInstanceUIDs: string[]): Promise<StudyProcessingSummary[]>;
}

export function createRESTStudyProcessingSnapshotTransport(
  repository: StudyProcessingRESTRepository = createStudyProcessingRESTRepository()
): StudyProcessingSnapshotTransport {
  return {
    async loadVisibleStudySnapshot(studyInstanceUIDs: string[]): Promise<StudyProcessingSummary[]> {
      if (studyInstanceUIDs.length === 0) {
        return [];
      }

      const result = await repository.loadWorklistStudyStatuses({
        studyInstanceUIDs,
        limit: studyInstanceUIDs.length,
        offset: 0,
      });
      return result.summaries;
    },
  };
}

export function createFixtureStudyProcessingSnapshotTransport(): StudyProcessingSnapshotTransport {
  return {
    async loadVisibleStudySnapshot(studyInstanceUIDs: string[]): Promise<StudyProcessingSummary[]> {
      return createVisibleStudyProcessingFixtureSnapshot(studyInstanceUIDs);
    },
  };
}
