// Patient names are not stored by the gateway. They are read from the local
// PACS (the DICOMweb store the viewer opens), with the cached lookup the
// processing notifications use: one QIDO request per study, remembered for
// the page, failed lookups retried after a minute.

import Api from '../../pacsAPIAxios';
import {
  mapQIDOStudyNotificationMetadata,
  STUDY_NOTIFICATION_QIDO_PATH,
} from '../../components/inference/studyNotificationMetadataRepository';
import {
  createStudyNotificationMetadataResolver,
  isLookupableStudyInstanceUID,
  type ResolvedStudyNotificationMetadata,
  type StudyNotificationMetadataResolver,
} from '../../components/inference/studyNotificationMetadata';
import { readablePersonName } from './presentation';
import type { PredictionExam, PredictionStudyLabels } from './types';

const TAG_STUDY_DESCRIPTION = '00081030';
const TAG_STUDY_INSTANCE_UID = '0020000D';

export interface PredictionStudyMetadata extends ResolvedStudyNotificationMetadata {
  studyDescription: string | null;
}

type HTTPGet = (
  url: string,
  config: { headers: Record<string, string>; params: Record<string, string>; timeout: number }
) => Promise<{ data?: unknown }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstValue(study: Record<string, unknown>, tag: string): string | null {
  const element = study[tag];
  const value = isRecord(element) && Array.isArray(element.Value) ? element.Value[0] : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function fetchPredictionStudyMetadata(
  studyInstanceUID: string,
  get: HTTPGet = (url, config) => Api().get(url, config)
): Promise<PredictionStudyMetadata | null> {
  if (!isLookupableStudyInstanceUID(studyInstanceUID)) {
    return null;
  }
  const response = await get(STUDY_NOTIFICATION_QIDO_PATH, {
    headers: { Accept: 'application/dicom+json' },
    params: { StudyInstanceUID: studyInstanceUID, limit: '2', includefield: TAG_STUDY_DESCRIPTION },
    timeout: 10_000,
  });
  const metadata = mapQIDOStudyNotificationMetadata(response?.data, studyInstanceUID);
  if (!metadata) {
    return null;
  }
  const study = Array.isArray(response?.data)
    ? response.data.find(
        (candidate: unknown): candidate is Record<string, unknown> =>
          isRecord(candidate) && firstValue(candidate, TAG_STUDY_INSTANCE_UID) === studyInstanceUID
      )
    : undefined;
  return { ...metadata, studyDescription: study ? firstValue(study, TAG_STUDY_DESCRIPTION) : null };
}

export function createPredictionStudyResolver(
  fetchStudy: (uid: string) => Promise<PredictionStudyMetadata | null> = uid =>
    fetchPredictionStudyMetadata(uid)
): StudyNotificationMetadataResolver {
  return createStudyNotificationMetadataResolver({ fetchStudy });
}

/** The labels of an exam: the local PACS first, the gateway's stored values otherwise. */
export function predictionStudyLabels(
  exam: PredictionExam,
  metadata: ResolvedStudyNotificationMetadata | null
): PredictionStudyLabels {
  const description =
    metadata && 'studyDescription' in metadata
      ? ((metadata as PredictionStudyMetadata).studyDescription ?? null)
      : null;
  return {
    patientName: readablePersonName(metadata?.patientName ?? null),
    patientId: metadata?.patientId ?? exam.patientId,
    accessionNumber: metadata?.accessionNumber ?? exam.accessionNumber,
    modalitiesInStudy:
      (metadata?.modalitiesInStudy ?? exam.modalitiesInStudy)?.replace(/\\/g, ', ') ?? null,
    studyDescription: description,
  };
}

/** Name search on what is loaded: case-insensitive, DICOM ^ separators ignored. */
export function patientNameMatches(labels: PredictionStudyLabels, search: string): boolean {
  const needle = search.trim().toLowerCase();
  return Boolean(needle && labels.patientName && labels.patientName.toLowerCase().includes(needle));
}
