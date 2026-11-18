import Api from '@pacs-ai/extension-core/src/pacsAPIAxios';
import { modalityOptions } from '../worklist/modalityOptions';

/**
 * Guided "open a study" flow of the tutorial's "Run Inference to Model" step.
 *
 * Outside the viewer the step takes the user to the study list with one
 * modality selected and the dates cleared, runs the search, and walks them
 * into a study. The step's own tour (the AI model button) then starts in the
 * viewer. The pending step is kept in sessionStorage because the study list
 * and the viewer are different routes.
 */

/** Work-list URL parameter that makes the URL filters win over a stored search. */
export const TUTORIAL_SEARCH_PARAM = 'tutorialSearch';

/** Tour targets on the study list. */
export const WORKLIST_STUDY_ROW_TOUR_ID = 'worklist-study-row';
export const WORKLIST_OPEN_VIEWER_TOUR_ID = 'worklist-open-viewer';
/** Present (hidden) when the tutorial's search found no study. */
export const WORKLIST_NO_STUDIES_TOUR_ID = 'worklist-no-studies';

export const tourTarget = (tourId: string): string => `[data-tour-id="${tourId}"]`;

const PENDING_STEP_KEY = 'pacsai.tutorial.pendingStep';

/** Angio first, then echo: the modalities most PACS-AI models take. */
const PREFERRED_MODALITIES = ['XA', 'US'];
const DEFAULT_MODALITY = 'XA';

type ModelWithModalities = { supportedDicomModalities?: string[] | null };

/**
 * The modality to search for: one an available model supports, preferring
 * XA then US, and only codes the work list's modality filter offers.
 */
export function pickTutorialModality(models: ModelWithModalities[] = []): string {
  const offered = new Set(modalityOptions.map(option => option.value));
  const supported = new Set<string>();
  models.forEach(model =>
    (model?.supportedDicomModalities || []).forEach(code => {
      const normalized = String(code || '').trim().toUpperCase();
      if (offered.has(normalized)) {
        supported.add(normalized);
      }
    })
  );

  const preferred = PREFERRED_MODALITIES.find(code => supported.has(code));
  if (preferred) {
    return preferred;
  }
  const [first] = Array.from(supported).sort();
  return first || DEFAULT_MODALITY;
}

type StudyWhen = { studyInstanceUID: string; studyDate?: string | null; studyTime?: string | null };

/**
 * The study the tutorial opens: the most recent one by study date and time
 * (DICOM YYYYMMDD and HHMMSS sort as text) among those already stored on the
 * PACS-AI server (`localUIDs`), so opening it retrieves nothing from the
 * hospital PACS. Null when none of the studies is stored.
 */
export function pickTutorialStudy<T extends StudyWhen>(
  studies: T[] = [],
  localUIDs: Set<string> = new Set()
): T | null {
  let newest: T | null = null;
  let newestKey = '';
  for (const study of studies) {
    if (!localUIDs.has(study.studyInstanceUID)) {
      continue;
    }
    const key = `${(study.studyDate || '').trim()}${(study.studyTime || '').trim()}`;
    if (!newest || key > newestKey) {
      newest = study;
      newestKey = key;
    }
  }
  return newest;
}

/** The local PACS as the viewer reads it (see the `dicomweb` data source). */
export const LOCAL_QIDO_STUDIES_PATH = '/proxy/orthanc/dicom-web/studies';
const LOCAL_LOOKUP_LIMIT = '500';
const LOCAL_LOOKUP_TIMEOUT_MS = 15_000;
const TAG_STUDY_INSTANCE_UID = '0020000D';

type HTTPGet = (
  url: string,
  config: { headers: Record<string, string>; params: Record<string, string>; timeout: number }
) => Promise<{ data?: unknown }>;

/**
 * UIDs of the studies of `modality` already stored on the PACS-AI server.
 * The tutorial opens one of these: opening it needs no retrieve from the
 * hospital PACS, where an archived study can hold Orthanc's retrieve slots
 * for minutes. Resolves with an empty set when the lookup fails.
 */
export async function fetchLocalStudyUIDs(
  modality: string,
  get: HTTPGet = (url, config) => Api().get(url, config)
): Promise<Set<string>> {
  try {
    const response = await get(LOCAL_QIDO_STUDIES_PATH, {
      headers: { Accept: 'application/dicom+json' },
      params: { ModalitiesInStudy: modality, limit: LOCAL_LOOKUP_LIMIT },
      timeout: LOCAL_LOOKUP_TIMEOUT_MS,
    });
    const studies = Array.isArray(response?.data) ? response.data : [];
    const uids = new Set<string>();
    studies.forEach(study => {
      const value = study?.[TAG_STUDY_INSTANCE_UID]?.Value?.[0];
      if (typeof value === 'string' && value.trim()) {
        uids.add(value.trim());
      }
    });
    return uids;
  } catch (error) {
    return new Set();
  }
}

/** Study list with the modality selected, the dates cleared and the search run. */
export function buildTutorialWorklistPath(modality: string): string {
  const params = new URLSearchParams({
    modalitiesInStudy: modality,
    studyDate: '',
    [TUTORIAL_SEARCH_PARAM]: '1',
  });
  return `/?${params.toString()}`;
}

export function isTutorialSearch(searchParams: URLSearchParams): boolean {
  return searchParams.get(TUTORIAL_SEARCH_PARAM) === '1';
}

export function setPendingTutorialStep(stepId: string): void {
  try {
    sessionStorage.setItem(PENDING_STEP_KEY, stepId);
  } catch (error) {
    // storage unavailable: the step then has to be started again from the card
  }
}

export function getPendingTutorialStep(): string | null {
  try {
    return sessionStorage.getItem(PENDING_STEP_KEY);
  } catch (error) {
    return null;
  }
}

export function clearPendingTutorialStep(): void {
  try {
    sessionStorage.removeItem(PENDING_STEP_KEY);
  } catch (error) {
    // nothing to clear
  }
}

/**
 * Resolves with the first element matching `selector` once it is in the page,
 * or null after `timeoutMs` or when `signal` aborts.
 */
export function waitForElement(
  selector: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Element | null> {
  return new Promise(resolve => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    let settled = false;
    const finish = (element: Element | null) => {
      if (settled) {
        return;
      }
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(element);
    };
    const onAbort = () => finish(null);
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        finish(element);
      }
    });
    const timer = setTimeout(() => finish(null), timeoutMs);

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    if (signal) {
      if (signal.aborted) {
        finish(null);
        return;
      }
      signal.addEventListener('abort', onAbort);
    }
  });
}
