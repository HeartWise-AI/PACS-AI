import {
  fetchStudyNotificationMetadata,
  mapQIDOStudyNotificationMetadata,
  STUDY_NOTIFICATION_QIDO_PATH,
} from './studyNotificationMetadataRepository';

jest.mock('../../pacsAPIAxios', () => ({ __esModule: true, default: jest.fn() }));

// Synthetic QIDO-RS answer; no real patient or study.
const UID = '1.2.826.0.1.3680043.8.498.1';
const qidoStudy = {
  '00080050': { vr: 'SH', Value: ['SYN-ACC-42'] },
  '00080061': { vr: 'CS', Value: ['US', 'SR'] },
  '00100010': { vr: 'PN', Value: [{ Alphabetic: 'SYNTHETIC^PATIENT' }] },
  '00100020': { vr: 'LO', Value: ['SYN-0001'] },
  '0020000D': { vr: 'UI', Value: [UID] },
};

describe('study notification metadata repository', () => {
  it('maps the patient, MRN, accession and modalities of the study', () => {
    expect(mapQIDOStudyNotificationMetadata([qidoStudy], UID)).toEqual({
      accessionNumber: 'SYN-ACC-42',
      modalitiesInStudy: 'US\\SR',
      patientId: 'SYN-0001',
      patientName: 'SYNTHETIC^PATIENT',
      studyInstanceUID: UID,
    });
  });

  it('tolerates missing attributes', () => {
    expect(mapQIDOStudyNotificationMetadata([{ '0020000D': { Value: [UID] } }], UID)).toEqual({
      accessionNumber: null,
      modalitiesInStudy: null,
      patientId: null,
      patientName: null,
      studyInstanceUID: UID,
    });
  });

  it('never uses a study other than the requested one', () => {
    expect(mapQIDOStudyNotificationMetadata([qidoStudy], '1.2.3')).toBeNull();
    expect(mapQIDOStudyNotificationMetadata([], UID)).toBeNull();
    expect(mapQIDOStudyNotificationMetadata({ unexpected: true }, UID)).toBeNull();
    expect(mapQIDOStudyNotificationMetadata(null, UID)).toBeNull();
  });

  it('searches the local PACS by study UID', async () => {
    const get = jest.fn().mockResolvedValue({ data: [qidoStudy] });

    await expect(fetchStudyNotificationMetadata(UID, get)).resolves.toEqual(
      expect.objectContaining({ patientName: 'SYNTHETIC^PATIENT' })
    );
    expect(get).toHaveBeenCalledWith(
      STUDY_NOTIFICATION_QIDO_PATH,
      expect.objectContaining({ params: { StudyInstanceUID: UID, limit: '2' } })
    );
  });

  it('does not send a malformed identifier', async () => {
    const get = jest.fn();

    await expect(fetchStudyNotificationMetadata('not a uid', get)).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
