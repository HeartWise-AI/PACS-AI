import { toggleExpandedStudyRow, type ExpandedStudyRows } from './expandedStudyRows';

describe('expanded study rows', () => {
  it('tracks expansion by Study Instance UID', () => {
    const expandedStudyRows = toggleExpandedStudyRow({}, 'study-a');

    expect(expandedStudyRows).toEqual({ 'study-a': true });
  });

  it('keeps expansion attached to the same study after rows are reordered', () => {
    const expandedStudyRows = toggleExpandedStudyRow({}, 'study-a');
    const reorderedStudyInstanceUIDs = ['study-b', 'study-a'];

    expect(
      reorderedStudyInstanceUIDs.filter(studyInstanceUID => expandedStudyRows[studyInstanceUID])
    ).toEqual(['study-a']);
  });

  it('collapses a study without changing other expanded studies', () => {
    const expandedStudyRows: ExpandedStudyRows = {
      'study-a': true,
      'study-b': true,
    };

    expect(toggleExpandedStudyRow(expandedStudyRows, 'study-a')).toEqual({
      'study-b': true,
    });
    expect(expandedStudyRows).toEqual({
      'study-a': true,
      'study-b': true,
    });
  });
});
