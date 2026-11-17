import { createPredictionStudyResolver, predictionStudyLabels } from './studyLabels';
import { exam } from './testSupport';

const STUDY = '1.2.826.0.1.3680043.10.1';
const metadata = {
  studyInstanceUID: STUDY,
  patientName: 'SYNTHETIC^PATIENT',
  patientId: 'SYN-MRN-1',
  accessionNumber: 'SYN-ACC-1',
  modalitiesInStudy: 'XA',
  studyDescription: null,
};

describe('AI predictions study labels', () => {
  test('an exam the store has, has, without a name, or no longer has', () => {
    const row = exam();
    expect(predictionStudyLabels(row, metadata)).toMatchObject({
      stored: 'yes',
      patientName: 'SYNTHETIC PATIENT',
    });
    expect(predictionStudyLabels(row, { ...metadata, patientName: null })).toMatchObject({
      stored: 'yes',
      patientName: null,
    });
    // Images removed: the gateway's MRN and accession stay, no name.
    expect(predictionStudyLabels(row, null, true)).toEqual({
      stored: 'no',
      patientName: null,
      patientId: 'SYN-MRN-1',
      accessionNumber: 'SYN-ACC-1',
      modalitiesInStudy: 'XA',
      studyDescription: null,
    });
    expect(predictionStudyLabels(row, null).stored).toBe('unknown');
  });

  test('only a lookup that found no study marks the exam as not stored', async () => {
    const fetchStudy = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(metadata);
    const resolver = createPredictionStudyResolver(fetchStudy);
    expect(await resolver.resolve(STUDY)).toBeNull();
    expect(resolver.isNotStored?.(STUDY)).toBe(true);

    const failing = createPredictionStudyResolver(
      jest.fn().mockRejectedValue(new Error('network'))
    );
    expect(await failing.resolve(STUDY)).toBeNull();
    expect(failing.isNotStored?.(STUDY)).toBe(false);

    const found = createPredictionStudyResolver(jest.fn().mockResolvedValue(metadata));
    expect(await found.resolve(STUDY)).toEqual(metadata);
    expect(found.isNotStored?.(STUDY)).toBe(false);
  });
});
