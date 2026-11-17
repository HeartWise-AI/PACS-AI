import { createVisibleStudyProcessingFixtureSnapshot } from './fixtureAdapter';
import { studyProcessingSummaryFixtures } from './fixtures';

describe('study processing fixture adapter', () => {
  it('joins fixture states to visible worklist studies by Study Instance UID', () => {
    const studyInstanceUIDs = ['study-1', 'study-2', 'study-3'];

    const snapshot = createVisibleStudyProcessingFixtureSnapshot(studyInstanceUIDs);

    expect(snapshot.map(summary => summary.studyInstanceUID)).toEqual(studyInstanceUIDs);
    expect(snapshot.map(summary => summary.lifecycle)).toEqual([
      studyProcessingSummaryFixtures.waiting.lifecycle,
      studyProcessingSummaryFixtures.retrieving.lifecycle,
      studyProcessingSummaryFixtures.queued.lifecycle,
    ]);
  });

  it('does not change the canonical fixture Study Instance UIDs', () => {
    const originalStudyInstanceUID = studyProcessingSummaryFixtures.waiting.studyInstanceUID;

    createVisibleStudyProcessingFixtureSnapshot(['visible-study']);

    expect(studyProcessingSummaryFixtures.waiting.studyInstanceUID).toBe(originalStudyInstanceUID);
  });
});
