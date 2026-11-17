import { studyProcessingSummaryFixtures } from '@pacs-ai/extension-core/src/studyProcessing/fixtures';
import type { StudyProcessingSummary } from '@pacs-ai/extension-core/src/studyProcessing/types';

const fixtureSummaries = Object.values(studyProcessingSummaryFixtures);

export function createVisibleStudyProcessingFixtureSnapshot(
  studyInstanceUIDs: string[]
): StudyProcessingSummary[] {
  return studyInstanceUIDs.map((studyInstanceUID, index) => {
    const fixture = fixtureSummaries[index % fixtureSummaries.length];

    return {
      ...fixture,
      studyInstanceUID,
      runId: fixture.runId ? `${fixture.runId}-${index + 1}` : null,
    };
  });
}
