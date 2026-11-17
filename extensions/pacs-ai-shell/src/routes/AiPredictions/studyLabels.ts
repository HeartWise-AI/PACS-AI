// Patient names are not stored by the gateway. They are read from the local
// PACS (the DICOMweb store the viewer opens), with the cached lookup the
// processing notifications use: one QIDO request per study, remembered for
// the page, failed lookups retried after a minute.

import Api from '@pacs-ai/extension-core/src/pacsAPIAxios';
import {
  mapQIDOStudyNotificationMetadata,
  STUDY_NOTIFICATION_QIDO_PATH,
} from '@pacs-ai/extension-core/src/inferenceProcessing/studyNotificationMetadataRepository';
import {
  createStudyNotificationMetadataResolver,
  isLookupableStudyInstanceUID,
  type ResolvedStudyNotificationMetadata,
  type StudyNotificationMetadataResolver,
} from '@pacs-ai/extension-core/src/inferenceProcessing/studyNotificationMetadata';
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

/** The study lookup of the page, which also remembers the exams the store does not have. */
export interface PredictionStudyResolver extends StudyNotificationMetadataResolver {
  /** True when the last lookup answered that the local store has no such study. */
  isNotStored?(studyInstanceUID: string): boolean;
}

export function createPredictionStudyResolver(
  fetchStudy: (uid: string) => Promise<PredictionStudyMetadata | null> = uid =>
    fetchPredictionStudyMetadata(uid)
): PredictionStudyResolver {
  // A failed request is not an answer: only a lookup that returned no study
  // marks the exam as not stored.
  const notStored = new Set<string>();
  const resolver = createStudyNotificationMetadataResolver({
    fetchStudy: async uid => {
      const metadata = await fetchStudy(uid);
      if (metadata) {
        notStored.delete(uid);
      } else {
        notStored.add(uid);
      }
      return metadata;
    },
  });
  return { ...resolver, isNotStored: uid => notStored.has(uid) };
}

/**
 * The labels of an exam: the local PACS first, the gateway's stored values
 * otherwise. The gateway stores no patient name, so an exam the store no
 * longer has keeps its MRN and accession but no name.
 */
export function predictionStudyLabels(
  exam: PredictionExam,
  metadata: ResolvedStudyNotificationMetadata | null,
  notStored = false
): PredictionStudyLabels {
  const description =
    metadata && 'studyDescription' in metadata
      ? ((metadata as PredictionStudyMetadata).studyDescription ?? null)
      : null;
  return {
    stored: metadata ? 'yes' : notStored ? 'no' : 'unknown',
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
