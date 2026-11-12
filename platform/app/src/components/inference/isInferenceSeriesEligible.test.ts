import { isInferenceSeriesEligible } from './isInferenceSeriesEligible';

describe('video inference series eligibility', () => {
  test.each(['RAPPORT', 'Rapport final', 'REPORT - procedure', 'Export.PDF'])(
    'excludes document descriptions: %s', description => {
      expect(isInferenceSeriesEligible({ description, numImageFrames: 30 })).toBe(false);
    }
  );

  test.each([
    { modality: 'SR' },
    { Modality: 'DOC' },
    { SOPClassUID: '1.2.840.10008.5.1.4.1.1.104.1' },
    { sopClassUids: ['1.2.840.10008.5.1.4.1.1.88.33'] },
  ])('excludes document types even without a report description: %j', metadata => {
    expect(isInferenceSeriesEligible(metadata)).toBe(false);
  });

  test('excludes single frames and empty display sets', () => {
    expect(isInferenceSeriesEligible({ numImageFrames: 1 })).toBe(false);
    expect(isInferenceSeriesEligible({ NumberOfFrames: '1' })).toBe(false);
    expect(isInferenceSeriesEligible({ numImageFrames: 0 })).toBe(false);
  });

  test('retains multi-frame cine, stacks, and unknown counts without guessing from instances', () => {
    expect(isInferenceSeriesEligible({ numImageFrames: 40 })).toBe(true);
    expect(isInferenceSeriesEligible({ NumberOfFrames: '24' })).toBe(true);
    expect(isInferenceSeriesEligible({ isMultiFrame: true })).toBe(true);
    expect(isInferenceSeriesEligible({})).toBe(true);
    expect(isInferenceSeriesEligible({ numInstances: 1, NumberOfFrames: 40 } as any)).toBe(true);
    expect(isInferenceSeriesEligible({ description: 'Coronary support', numImageFrames: 20 })).toBe(true);
  });
});
