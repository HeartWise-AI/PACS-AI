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
