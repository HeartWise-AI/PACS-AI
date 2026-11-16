import Api from '../../pacsAPIAxios';
import {
  isLookupableStudyInstanceUID,
  type ResolvedStudyNotificationMetadata,
} from './studyNotificationMetadata';

// The local PACS as the viewer's own data source reads it (see the `dicomweb`
// data source in public/config/local_pacs_ai.js). A study that was processed is
// stored there, whichever source PACS the work list is currently pointed at.
export const STUDY_NOTIFICATION_QIDO_PATH = '/proxy/orthanc/dicom-web/studies';
const LOOKUP_TIMEOUT_MS = 10_000;

const TAG_ACCESSION_NUMBER = '00080050';
const TAG_MODALITIES_IN_STUDY = '00080061';
const TAG_PATIENT_NAME = '00100010';
const TAG_PATIENT_ID = '00100020';
const TAG_STUDY_INSTANCE_UID = '0020000D';

type HTTPGet = (
  url: string,
  config: { headers: Record<string, string>; params: Record<string, string>; timeout: number }
) => Promise<{ data?: unknown }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tagValues(study: Record<string, unknown>, tag: string): unknown[] {
  const element = study[tag];
  return isRecord(element) && Array.isArray(element.Value) ? element.Value : [];
}

function text(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function personName(value: unknown): string | null {
  // DICOM JSON person names are objects; some servers send the plain string.
  return isRecord(value) ? text(value.Alphabetic) : text(value);
}

/** Maps a QIDO-RS study search answer to the labels of one study. */
export function mapQIDOStudyNotificationMetadata(
  data: unknown,
  studyInstanceUID: string
): ResolvedStudyNotificationMetadata | null {
  if (!Array.isArray(data)) {
    return null;
  }

  // A server that ignores the filter would answer with unrelated studies, so
  // only an entry carrying the requested UID is ever used.
  const study = data.find(
    (candidate): candidate is Record<string, unknown> =>
      isRecord(candidate) &&
      text(tagValues(candidate, TAG_STUDY_INSTANCE_UID)[0]) === studyInstanceUID
  );
  if (!study) {
    return null;
  }

  const modalities = tagValues(study, TAG_MODALITIES_IN_STUDY)
    .map(text)
    .filter((modality): modality is string => modality !== null);

  return {
    accessionNumber: text(tagValues(study, TAG_ACCESSION_NUMBER)[0]),
    // Same multi-value form as the work list rows.
    modalitiesInStudy: modalities.length ? modalities.join('\\') : null,
    patientId: text(tagValues(study, TAG_PATIENT_ID)[0]),
    patientName: personName(tagValues(study, TAG_PATIENT_NAME)[0]),
    studyInstanceUID,
  };
}

export async function fetchStudyNotificationMetadata(
  studyInstanceUID: string,
  get: HTTPGet = (url, config) => Api().get(url, config)
): Promise<ResolvedStudyNotificationMetadata | null> {
  if (!isLookupableStudyInstanceUID(studyInstanceUID)) {
    return null;
  }

  const response = await get(STUDY_NOTIFICATION_QIDO_PATH, {
    headers: { Accept: 'application/dicom+json' },
    params: { StudyInstanceUID: studyInstanceUID, limit: '2' },
    timeout: LOOKUP_TIMEOUT_MS,
  });
  return mapQIDOStudyNotificationMetadata(response?.data, studyInstanceUID);
}
