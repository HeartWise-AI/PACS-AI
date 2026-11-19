import { buildInferenceStudyModalities, inferenceStudyUIDs } from './buildInferenceStudyModalities';

test('preserves AI model modality filtering and both exams with the same modality', () => {
  const groups = buildInferenceStudyModalities([
    {
      modalities: 'XA',
      studyInstanceUid: 'old',
      date: '2016-01-01',
      displaySets: [{ SeriesInstanceUID: 'a' }],
    },
    {
      modalities: 'XA',
      studyInstanceUid: 'new',
      date: '2026-11-12',
      displaySets: [{ SeriesInstanceUID: 'b' }],
    },
  ]);
  expect(Object.keys(groups).some(modality => modality.includes('XA'))).toBe(true);
  expect(groups.XA.displaySets.map(series => series.StudyInstanceUID)).toEqual(['old', 'new']);
  expect(groups.XA.displaySets.map(series => series.studyDate)).toEqual([
    '2016-01-01',
    '2026-11-12',
  ]);
});

test('clears removed exams when rebuilding viewer state', () => {
  expect(buildInferenceStudyModalities([])).toEqual({});
});

test('lists each group exams before their images load', () => {
  const groups = buildInferenceStudyModalities([
    { modalities: 'US', studyInstanceUid: 'tte', date: '2026-10-09', description: 'TTE' },
    { modalities: 'XA', studyInstanceUid: 'cath', date: '2026-11-17', displaySets: [] },
    {
      modalities: 'XA',
      studyInstanceUid: 'cath',
      date: '2026-11-17',
      displaySets: [{ SeriesInstanceUID: 's' }],
    },
  ]);
  expect(groups.US.studies).toEqual([
    { studyInstanceUID: 'tte', date: '2026-10-09', description: 'TTE' },
  ]);
  expect(groups.XA.studies.map(study => study.studyInstanceUID)).toEqual(['cath']);
  expect(inferenceStudyUIDs(groups)).toEqual(['tte', 'cath']);
});
