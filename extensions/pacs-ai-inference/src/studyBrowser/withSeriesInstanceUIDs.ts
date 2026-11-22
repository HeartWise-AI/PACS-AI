type BrowserDisplaySet = { displaySetInstanceUID: string; [key: string]: unknown };
type ActiveDisplaySet = { displaySetInstanceUID: string; SeriesInstanceUID?: string };

/**
 * Adds each study browser display set's SeriesInstanceUID, taken from the
 * display set service's active display sets. PACS-AI used to do this inside
 * @ohif/core's createStudyBrowserTabs; the run-model menu and the chat read it
 * from the study context. Display sets that are not active are returned as
 * they are.
 */
export function withSeriesInstanceUIDs<T extends BrowserDisplaySet>(
  displaySets: T[],
  activeDisplaySets?: ActiveDisplaySet[] | null
): T[] {
  if (!activeDisplaySets) {
    return displaySets;
  }
  return displaySets.map(ds => {
    const activeDs = activeDisplaySets.find(
      ads => ads.displaySetInstanceUID === ds.displaySetInstanceUID
    );
    return activeDs ? { ...ds, SeriesInstanceUID: activeDs.SeriesInstanceUID } : ds;
  });
}
