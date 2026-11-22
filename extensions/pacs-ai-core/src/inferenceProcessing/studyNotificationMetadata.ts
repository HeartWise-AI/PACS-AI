// Patient and modality labels for processing notifications whose study is not
// on the visible work-list page. The work list only publishes metadata for the
// rows on screen, so anything else is looked up once per session from the local
// PACS (the same DICOMweb store the viewer reads) and cached.

export interface ResolvedStudyNotificationMetadata {
  accessionNumber: string | null;
  modalitiesInStudy: string | null;
  patientId: string | null;
  patientName: string | null;
  studyInstanceUID: string;
}

export type FetchStudyNotificationMetadata = (
  studyInstanceUID: string
) => Promise<ResolvedStudyNotificationMetadata | null>;

export interface StudyNotificationMetadataResolver {
  /** Forgets everything; lookups still in flight resolve to null. */
  clear(): void;
  /** The cached metadata, without starting a lookup. */
  peek(studyInstanceUID: string): ResolvedStudyNotificationMetadata | null;
  /** Never rejects: null means the study could not be resolved. */
  resolve(studyInstanceUID: string): Promise<ResolvedStudyNotificationMetadata | null>;
}

export interface StudyNotificationMetadataResolverOptions {
  fetchStudy: FetchStudyNotificationMetadata;
  maxEntries?: number;
  // How long a failed or empty lookup is remembered before it may be retried.
  missRetryAfterMs?: number;
  now?: () => number;
}

export const STUDY_NOTIFICATION_METADATA_MAX_ENTRIES = 200;
export const STUDY_NOTIFICATION_METADATA_MISS_RETRY_MS = 60_000;

const DICOM_UID_PATTERN = /^[0-9]+(\.[0-9]+)*$/;

export function isLookupableStudyInstanceUID(studyInstanceUID: string): boolean {
  return studyInstanceUID.length <= 64 && DICOM_UID_PATTERN.test(studyInstanceUID);
}

type CacheEntry =
  | { kind: 'hit'; metadata: ResolvedStudyNotificationMetadata }
  | { kind: 'miss'; at: number };

export function createStudyNotificationMetadataResolver({
  fetchStudy,
  maxEntries = STUDY_NOTIFICATION_METADATA_MAX_ENTRIES,
  missRetryAfterMs = STUDY_NOTIFICATION_METADATA_MISS_RETRY_MS,
  now = Date.now,
}: StudyNotificationMetadataResolverOptions): StudyNotificationMetadataResolver {
  // Insertion order is recency order: the first key is the least recently used.
  let cache = new Map<string, CacheEntry>();
  let inFlight = new Map<string, Promise<ResolvedStudyNotificationMetadata | null>>();
  let epoch = 0;

  function remember(studyInstanceUID: string, entry: CacheEntry) {
    cache.delete(studyInstanceUID);
    cache.set(studyInstanceUID, entry);
    while (cache.size > Math.max(1, maxEntries)) {
      cache.delete(cache.keys().next().value as string);
    }
  }

  function peek(studyInstanceUID: string) {
    const entry = cache.get(studyInstanceUID);
    return entry?.kind === 'hit' ? entry.metadata : null;
  }

  function resolve(studyInstanceUID: string) {
    if (!isLookupableStudyInstanceUID(studyInstanceUID)) {
      return Promise.resolve(null);
    }

    const entry = cache.get(studyInstanceUID);
    if (entry?.kind === 'hit') {
      remember(studyInstanceUID, entry);
      return Promise.resolve(entry.metadata);
    }
    if (entry?.kind === 'miss' && now() - entry.at < missRetryAfterMs) {
      return Promise.resolve(null);
    }

    const pending = inFlight.get(studyInstanceUID);
    if (pending) {
      return pending;
    }

    const startedEpoch = epoch;
    const lookup = Promise.resolve()
      .then(() => fetchStudy(studyInstanceUID))
      .catch(() => null)
      .then(metadata => {
        if (startedEpoch !== epoch) {
          return null;
        }
        inFlight.delete(studyInstanceUID);
        remember(
          studyInstanceUID,
          metadata ? { kind: 'hit', metadata } : { kind: 'miss', at: now() }
        );
        return metadata;
      });
    inFlight.set(studyInstanceUID, lookup);
    return lookup;
  }

  function clear() {
    epoch += 1;
    cache = new Map();
    inFlight = new Map();
  }

  return { clear, peek, resolve };
}
