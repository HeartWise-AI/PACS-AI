/**
 * OHIF compatibility adapter (PLAN.md 6.4): read-only access to display sets.
 * Our code never writes to displaySetService.getDisplaySetCache().
 */
type DisplaySetServiceLike = {
  getActiveDisplaySets?: () => unknown[];
  getDisplaySetByUID?: (displaySetInstanceUID: string) => unknown;
};

/** Display sets of the open studies; [] without a display set service. */
export function getActiveDisplaySets<T = any>(
  displaySetService: DisplaySetServiceLike | null | undefined
): T[] {
  return (displaySetService?.getActiveDisplaySets?.() as T[] | undefined) ?? [];
}

/** One display set by instance UID, or undefined. */
export function getDisplaySetByUID<T = any>(
  displaySetService: DisplaySetServiceLike | null | undefined,
  displaySetInstanceUID: string
): T | undefined {
  return displaySetService?.getDisplaySetByUID?.(displaySetInstanceUID) as T | undefined;
}

/** Whether display sets can be looked up by UID (the service may be a stub). */
export function hasDisplaySetLookup(displaySetService: DisplaySetServiceLike | null | undefined) {
  return typeof displaySetService?.getDisplaySetByUID === 'function';
}
