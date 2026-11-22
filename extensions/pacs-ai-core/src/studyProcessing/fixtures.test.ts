import {
  PROCESSING_RUN_OUTCOMES,
  STUDY_PROCESSING_LIFECYCLES,
  type StudyProcessingSummary,
} from './types';
import {
  modelExecutionFixtures,
  studyProcessingRunHistoryFixture,
  studyProcessingSnapshotFixture,
  studyProcessingSummaryFixtures,
  studyStatusUpdatedEventFixture,
} from './fixtures';

const summaries = Object.values(studyProcessingSummaryFixtures) as StudyProcessingSummary[];

describe('study processing fixtures', () => {
  test('cover every lifecycle and terminal outcome', () => {
    const lifecycles = new Set(summaries.map(item => item.lifecycle));
    const outcomes = new Set(summaries.map(item => item.outcome).filter(Boolean));

    expect(lifecycles).toEqual(new Set(STUDY_PROCESSING_LIFECYCLES));
    expect(outcomes).toEqual(new Set(PROCESSING_RUN_OUTCOMES));
  });

  test('keep model counts consistent with the expected plan', () => {
    summaries.forEach(item => {
      const accountedForModels =
        item.completedModels +
        item.failedModels +
        item.skippedModels +
        item.cancelledModels +
        item.activeModels;

      expect(accountedForModels).toBe(item.expectedModels);
    });
  });

  test('orders processing history newest first', () => {
    expect(studyProcessingRunHistoryFixture.runs.map(run => run.runNumber)).toEqual([3, 2, 1]);
  });

  test('provides a paginated snapshot of all summary fixtures', () => {
    expect(studyProcessingSnapshotFixture.items).toHaveLength(summaries.length);
    expect(studyProcessingSnapshotFixture.totalItems).toBe(summaries.length);
  });

  test('provides a newer SSE update for an existing study', () => {
    expect(studyStatusUpdatedEventFixture.type).toBe('study_status.updated');
    expect(studyStatusUpdatedEventFixture.studyInstanceUID).toBe(
      studyProcessingSummaryFixtures.processing.studyInstanceUID
    );
    expect(studyStatusUpdatedEventFixture.version).toBeGreaterThan(
      studyProcessingSummaryFixtures.processing.version
    );
  });

  test('covers terminal model execution variants', () => {
    expect(Object.values(modelExecutionFixtures).map(execution => execution.status)).toEqual(
      expect.arrayContaining(['completed', 'failed', 'skipped', 'cancelled'])
    );
  });
});
