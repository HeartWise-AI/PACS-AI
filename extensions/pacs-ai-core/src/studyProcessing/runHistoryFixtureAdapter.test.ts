import { studyProcessingSummaryFixtures } from './fixtures';
import { createStudyProcessingRunHistoryFixture } from './runHistoryFixtureAdapter';

describe('run history fixture adapter', () => {
  it('creates history for the visible study and preserves newest-first run order', () => {
    const summary = {
      ...studyProcessingSummaryFixtures.partialSuccess,
      studyInstanceUID: 'visible-study',
    };

    const history = createStudyProcessingRunHistoryFixture(summary);

    expect(history.studyInstanceUID).toBe('visible-study');
    expect(history.runs.map(run => run.runNumber)).toEqual([3, 2, 1]);
    expect(history.runs.every(run => run.studyInstanceUID === 'visible-study')).toBe(true);
    expect(history.runs[0]).toMatchObject({
      trigger: summary.trigger,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
    });
  });

  it('makes model execution states agree with the current summary counts', () => {
    const history = createStudyProcessingRunHistoryFixture(
      studyProcessingSummaryFixtures.partialSuccess
    );
    const statuses = history.runs[0].modelExecutions.map(execution => execution.status);

    expect(statuses).toEqual(['completed', 'completed', 'failed']);
  });

  it('returns no run history before a run exists', () => {
    expect(
      createStudyProcessingRunHistoryFixture(studyProcessingSummaryFixtures.retrieving).runs
    ).toEqual([]);
  });
});
