import { expect, type Page } from '@playwright/test';

export const THUMBNAIL = '[data-cy="study-browser-thumbnail"], [data-cy="study-browser-thumbnail-no-image"]';
export const AI_BUTTON = '[data-tour-id="ai-model-button"]';
export const PREVIOUS_RESULT = '[data-testid="ai-model-previous-result"]';
export const RESULT_DRAWER = '[data-testid="viewer-model-result-drawer"]';

export const viewerURL = (uid: string) => `/viewer?StudyInstanceUIDs=${encodeURIComponent(uid)}`;

/** The shepherd viewer tour, if it is showing. */
export const tourSkipButton = (page: Page) => page.getByText('Skip all', { exact: true });

/** Opens a study and waits until the study browser and a viewport are ready. */
export async function openViewer(
  page: Page,
  uid: string,
  { skipTour = true }: { skipTour?: boolean } = {}
): Promise<void> {
  await page.goto(viewerURL(uid));
  await expect(page.locator(THUMBNAIL).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('.cornerstone-viewport-element, [data-viewport-uid]').first()).toBeVisible({
    timeout: 60_000,
  });
  if (skipTour) await dismissTour(page);
}

export async function dismissTour(page: Page, waitMs = 4_000): Promise<boolean> {
  const skip = tourSkipButton(page);
  try {
    await skip.waitFor({ state: 'visible', timeout: waitMs });
  } catch {
    return false;
  }
  await skip.click();
  await expect(skip).toBeHidden();
  return true;
}

/** Opens the AI Models menu of the viewer header and waits for its list. */
export async function openAiMenu(page: Page): Promise<void> {
  // Opening the menu reloads the stored results (latest-results); the rows
  // only show "View result"/"Rerun" once that answer is in.
  const latestResults = page
    .waitForResponse(r => r.url().includes('/latest-results'), { timeout: 30_000 })
    .catch(() => null);
  await page.locator(AI_BUTTON).first().click();
  await latestResults;
  await expect(
    page.locator(`${PREVIOUS_RESULT}, li:has-text("Apply ")`).first().or(page.getByText('No inference models found'))
  ).toBeVisible({ timeout: 60_000 });
}

/** Model labels offered in the open AI menu: "<name> (<version>-<output mode>)". */
export async function menuModels(page: Page): Promise<Array<{ kind: 'rerun' | 'apply'; name: string }>> {
  const out: Array<{ kind: 'rerun' | 'apply'; name: string }> = [];
  for (const text of await page.locator(PREVIOUS_RESULT).allInnerTexts()) {
    out.push({ kind: 'rerun', name: text.split('\n')[0].trim() });
  }
  for (const text of await page.locator('li h1').allInnerTexts()) {
    const m = text.trim().match(/^Apply (.+)$/);
    if (m) out.push({ kind: 'apply', name: m[1].trim() });
  }
  return out;
}

/** OHIF services exposed on window by the cornerstone extension. */
export async function viewerState(page: Page) {
  return page.evaluate(() => {
    const services = (window as any).services;
    if (!services) return null;
    const grid = services.viewportGridService.getState();
    const activeId = grid.activeViewportId;
    const vp = grid.viewports.get ? grid.viewports.get(activeId) : grid.viewports[activeId];
    const displaySetUID = vp?.displaySetInstanceUIDs?.[0] ?? null;
    const ds = displaySetUID ? services.displaySetService.getDisplaySetByUID(displaySetUID) : null;
    let imageIndex: number | null = null;
    try {
      const csvp = services.cornerstoneViewportService.getCornerstoneViewport(activeId);
      imageIndex = csvp?.getCurrentImageIdIndex?.() ?? null;
    } catch {
      imageIndex = null;
    }
    const cine = services.cineService?.getState?.();
    return {
      activeViewportId: activeId as string,
      displaySetUID: displaySetUID as string | null,
      seriesNumber: (ds?.SeriesNumber ?? null) as number | string | null,
      modality: (ds?.Modality ?? null) as string | null,
      numImages: (ds?.numImageFrames ?? ds?.images?.length ?? null) as number | null,
      imageIndex,
      cinePlaying: !!cine?.cines?.[activeId]?.isPlaying,
    };
  });
}
