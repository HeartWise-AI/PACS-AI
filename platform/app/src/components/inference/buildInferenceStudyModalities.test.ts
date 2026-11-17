import { buildInferenceStudyModalities } from './buildInferenceStudyModalities';

test('preserves AI model modality filtering and both exams with the same modality', () => {
  const groups = buildInferenceStudyModalities([
    { modalities: 'XA', studyInstanceUid: 'old', date: '2016-01-01', displaySets: [{ SeriesInstanceUID: 'a' }] },
    { modalities: 'XA', studyInstanceUid: 'new', date: '2026-11-12', displaySets: [{ SeriesInstanceUID: 'b' }] },
  ]);
  expect(Object.keys(groups).some(modality => modality.includes('XA'))).toBe(true);
  expect(groups.XA.displaySets.map(series => series.StudyInstanceUID)).toEqual(['old', 'new']);
  expect(groups.XA.displaySets.map(series => series.studyDate)).toEqual(['2016-01-01', '2026-11-12']);
});

test('clears removed exams when rebuilding viewer state', () => {
  expect(buildInferenceStudyModalities([])).toEqual({});
});
