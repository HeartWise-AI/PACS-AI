import {
  MAX_BULK_STUDY_SELECTION,
  retainBulkStudySelection,
  selectVisibleBulkStudies,
  toggleBulkStudySelection,
} from './bulkStudySelection';

describe('bulk study selection', () => {
  it('tracks selection by Study Instance UID across row reordering', () => {
    const selected = toggleBulkStudySelection([], 'study-a');
    const reordered = ['study-b', 'study-a'];

    expect(reordered.filter(studyInstanceUID => selected.includes(studyInstanceUID))).toEqual([
      'study-a',
    ]);
  });

  it('selects each eligible visible study once and stays within the API limit', () => {
    const visible = Array.from(
      { length: MAX_BULK_STUDY_SELECTION + 2 },
      (_, index) => `study-${index}`
    );

    expect(selectVisibleBulkStudies([...visible, visible[0]])).toEqual(
      visible.slice(0, MAX_BULK_STUDY_SELECTION)
    );
  });

  it('drops studies that are no longer eligible or visible', () => {
    expect(retainBulkStudySelection(['study-a', 'study-b'], ['study-b', 'study-c'])).toEqual([
      'study-b',
    ]);
  });

  it('toggles one study without mutating the existing selection', () => {
    const selected = ['study-a', 'study-b'];

    expect(toggleBulkStudySelection(selected, 'study-a')).toEqual(['study-b']);
    expect(selected).toEqual(['study-a', 'study-b']);
  });
});
