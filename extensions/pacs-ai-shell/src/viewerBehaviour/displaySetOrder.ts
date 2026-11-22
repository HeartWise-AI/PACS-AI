/**
 * Keeps `displaySetService.getActiveDisplaySets()` in the order the study
 * browser shows (F15: the arrow keys go to the next series of the study
 * browser; the "Series: n/N" label counts in that order).
 *
 * OHIF's `updateViewportDisplaySet` command (the arrow keys) walks the active
 * display sets in their array order, and that array is in the order the
 * display sets were added. Since OHIF 3.13 the DICOMweb data source stores
 * each series' metadata asynchronously (`await resolveBulkDataTags`) when it
 * arrives, so display sets are added in network completion order (series
 * #1, #5, #2, ...); OHIF re-sorts its own copies for the hanging protocol and
 * the study browser tabs (`sortingCriteria` customization) but not the
 * active list. On 3.11.1 the arrival order followed the request order closely
 * enough that next/previous series matched the study browser.
 *
 * The order applied: studies in the order they first appeared (the study
 * opened first, then the other studies the study browser loads), and inside a
 * study the `sortingCriteria` customization the study browser itself uses
 * (series number, then instance number; SR, SEG and other low-priority
 * modalities last). `sortDisplaySets(..., suppressEvent = true)`, as OHIF's
 * own StudyBrowserSort does, so the sort does not trigger itself.
 */

const SORTING_CRITERIA_CUSTOMIZATION = 'sortingCriteria';

type DisplaySetLike = { StudyInstanceUID?: string; [key: string]: unknown };
type Comparator = (a: DisplaySetLike, b: DisplaySetLike) => number;

const running = new WeakMap<object, () => void>();

/** Comparator: study first-appearance order, then `seriesOrder` within a study. */
export function browserOrderComparator(
  studyOrder: Map<string | undefined, number>,
  seriesOrder: Comparator
): Comparator {
  return (a, b) => {
    const studyA = studyOrder.get(a?.StudyInstanceUID) ?? Number.MAX_SAFE_INTEGER;
    const studyB = studyOrder.get(b?.StudyInstanceUID) ?? Number.MAX_SAFE_INTEGER;
    if (studyA !== studyB) {
      return studyA - studyB;
    }
    return seriesOrder(a, b);
  };
}

/**
 * Sorts the active display sets now and after every addition or change,
 * until stopDisplaySetOrder. Safe to call twice for the same services.
 */
export function startDisplaySetOrder(servicesManager): void {
  const { displaySetService, customizationService } = servicesManager?.services ?? {};
  if (!displaySetService?.sortDisplaySets || running.has(displaySetService)) {
    return;
  }

  const studyOrder = new Map<string | undefined, number>();
  const sort = () => {
    const seriesOrder = customizationService?.getCustomization?.(SORTING_CRITERIA_CUSTOMIZATION) as
      | Comparator
      | undefined;
    if (typeof seriesOrder !== 'function') {
      return;
    }
    const displaySets: DisplaySetLike[] = displaySetService.getActiveDisplaySets?.() ?? [];
    displaySets.forEach(displaySet => {
      if (!studyOrder.has(displaySet?.StudyInstanceUID)) {
        studyOrder.set(displaySet?.StudyInstanceUID, studyOrder.size);
      }
    });
    displaySetService.sortDisplaySets(
      browserOrderComparator(studyOrder, seriesOrder),
      'ascending',
      true
    );
  };

  const { EVENTS } = displaySetService;
  const subscriptions = [EVENTS?.DISPLAY_SETS_ADDED, EVENTS?.DISPLAY_SETS_CHANGED]
    .filter(Boolean)
    .map(event => displaySetService.subscribe(event, sort));
  running.set(displaySetService, () =>
    subscriptions.forEach(subscription => subscription?.unsubscribe?.())
  );
  sort();
}

/** Stops what startDisplaySetOrder started. */
export function stopDisplaySetOrder(servicesManager): void {
  const displaySetService = servicesManager?.services?.displaySetService;
  if (!displaySetService) {
    return;
  }
  running.get(displaySetService)?.();
  running.delete(displaySetService);
}
