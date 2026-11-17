// Which PACS source ("DICOM modality" of the tenant) a study is retrieved from.
// The viewer URL does not carry it, so the work list records it per study for
// the tab; the work list's last selected modality and the tenant's only
// retrievable modality are the fallbacks.

export const STUDY_SOURCE_MODALITY_STORAGE_KEY = 'pacsai.studySourceModality';
// The work list's selected "DICOM Modality" (written by the work list).
export const SELECTED_DICOM_MODALITY_STORAGE_KEY = 'selectedDICOMModality';
const MAX_REMEMBERED_STUDIES = 50;

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface SourceModalityEntry {
  allowMove?: boolean;
  targetCMoveEnabled?: boolean;
}

export type SourceModalities = Record<string, SourceModalityEntry | null | undefined>;

export interface ResolvedSourceModality {
  modalityId: string;
  // 'study': recorded when the study was opened; 'worklist': the work list's
  // selected modality; 'single': the tenant's only retrievable modality.
  origin: 'study' | 'worklist' | 'single';
}

function safeStorage(kind: 'sessionStorage' | 'localStorage'): Storage | null {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch (error: unknown) {
    return null;
  }
}

function readRemembered(storage: ReadStorage | null): Array<[string, string]> {
  try {
    const parsed = JSON.parse(storage?.getItem(STUDY_SOURCE_MODALITY_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is [string, string] =>
            Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string'
        )
      : [];
  } catch (error: unknown) {
    return [];
  }
}

/** Records, for this tab, the modality a study is being opened from. */
export function rememberStudySourceModality(
  studyInstanceUID: string | null | undefined,
  modalityId: string | null | undefined,
  storage: WriteStorage | null = safeStorage('sessionStorage')
): void {
  const uid = studyInstanceUID?.trim();
  const id = modalityId?.trim();
  if (!uid || !id || !storage) {
    return;
  }
  try {
    const entries = readRemembered(storage).filter(([key]) => key !== uid);
    entries.push([uid, id]);
    storage.setItem(
      STUDY_SOURCE_MODALITY_STORAGE_KEY,
      JSON.stringify(entries.slice(-MAX_REMEMBERED_STUDIES))
    );
  } catch (error: unknown) {
    // Without storage the viewer falls back to the other sources.
  }
}

export function readStudySourceModality(
  studyInstanceUID: string,
  storage: ReadStorage | null = safeStorage('sessionStorage')
): string | null {
  const uid = studyInstanceUID.trim();
  const entry = readRemembered(storage).find(([key]) => key === uid);
  return entry ? entry[1] : null;
}

function isRetrievable(entry: SourceModalityEntry | null | undefined): boolean {
  return entry?.allowMove !== false && entry?.targetCMoveEnabled !== false;
}

export interface ResolveSourceModalityOptions {
  studyInstanceUID: string;
  // Rejects or resolves null when the tenant's modalities cannot be listed.
  loadModalities: () => Promise<SourceModalities | null | undefined>;
  sessionStorage?: ReadStorage | null;
  localStorage?: ReadStorage | null;
}

/**
 * The modality to retrieve the study from, or null when it cannot be
 * determined. A recorded modality the tenant no longer has is ignored.
 */
export async function resolveSourceModality({
  studyInstanceUID,
  loadModalities,
  sessionStorage = safeStorage('sessionStorage'),
  localStorage = safeStorage('localStorage'),
}: ResolveSourceModalityOptions): Promise<ResolvedSourceModality | null> {
  let modalities: SourceModalities | null = null;
  try {
    const loaded = await loadModalities();
    modalities = loaded ?? null;
  } catch (error: unknown) {
    modalities = null;
  }
  // Without the list a recorded modality is used as it is.
  const known = (id: string | null): id is string =>
    !!id && (!modalities || Object.prototype.hasOwnProperty.call(modalities, id));

  const fromStudy = readStudySourceModality(studyInstanceUID, sessionStorage);
  if (known(fromStudy)) {
    return { modalityId: fromStudy, origin: 'study' };
  }

  let fromWorklist: string | null = null;
  try {
    fromWorklist = localStorage?.getItem(SELECTED_DICOM_MODALITY_STORAGE_KEY)?.trim() || null;
  } catch (error: unknown) {
    fromWorklist = null;
  }
  if (known(fromWorklist)) {
    return { modalityId: fromWorklist, origin: 'worklist' };
  }

  const retrievable = Object.keys(modalities ?? {}).filter(id => isRetrievable(modalities?.[id]));
  return retrievable.length === 1 ? { modalityId: retrievable[0], origin: 'single' } : null;
}
