import type { Browser, Page } from '@playwright/test';
import fs from 'node:fs';
import { test, expect } from './support/fixtures';
import { env, storageStatePath, xaStudies } from './support/env';
import { ensureStudyLocal } from './support/studies';
import { dismissTour, openViewer, tourSkipButton } from './support/viewer';

/**
 * F9 — the viewer tour shows once per user: the server-side flag
 * (/v1/user/viewer-tour) wins over the browser, so the tour does not come
 * back after a reload or in another browser; Settings can re-enable it.
 */

/** Storage state of the test user without any browser-side tour memory. */
function freshBrowserState() {
  const state = JSON.parse(fs.readFileSync(storageStatePath, 'utf8'));
  for (const origin of state.origins ?? []) {
    origin.localStorage = (origin.localStorage ?? []).filter(
      (item: { name: string }) => !/shownTours|viewerTour/i.test(item.name)
    );
  }
  return state;
}

async function newBrowserPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: env.baseURL,
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 900 },
    storageState: freshBrowserState(),
  });
  return context.newPage();
}

async function tourShows(page: Page): Promise<boolean> {
  return tourSkipButton(page)
    .waitFor({ state: 'visible', timeout: 12_000 })
    .then(() => true)
    .catch(() => false);
}

let studyUID = '';

test.beforeEach(async ({ page }) => {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  studyUID = study.uid;
});

test('once seen, the tour does not show again after a reload or in another browser', async ({ browser }) => {
  const first = await newBrowserPage(browser);
  await openViewer(first, studyUID, { skipTour: false });
  if (await tourShows(first)) {
    // First visit of this user: the tour shows once; dismiss it.
    await dismissTour(first);
  }
  await first.reload();
  await expect(first.locator('[data-cy="study-browser-thumbnail"]').first()).toBeVisible({ timeout: 90_000 });
  expect(await tourShows(first), 'tour after reload').toBe(false);
  await first.context().close();

  const other = await newBrowserPage(browser);
  const tourState = other.waitForResponse(r => r.url().includes('/viewer-tour'), { timeout: 60_000 }).catch(() => null);
  await openViewer(other, studyUID, { skipTour: false });
  expect((await tourState)?.status() ?? 200, 'server-side tour state read').toBeLessThan(400);
  expect(await tourShows(other), 'tour in another browser').toBe(false);
  await other.context().close();
});

test('Settings re-enables the tour, which then shows once', async ({ page, browser }) => {
  test.skip(
    !env.allowUserPrefs,
    'changes the test user\'s own tour flag; set PACS_AI_E2E_ALLOW_USER_PREFS=1 to run (the flag ends "seen" again)'
  );
  await page.goto('/settings');
  await page.getByTestId('show-viewer-tour-again').click();
  await expect(page.getByText('The viewer tour will show the next time you open a study')).toBeVisible();

  const viewer = await newBrowserPage(browser);
  await openViewer(viewer, studyUID, { skipTour: false });
  expect(await tourShows(viewer), 'tour after re-enabling it').toBe(true);
  await dismissTour(viewer);
  await viewer.reload();
  await expect(viewer.locator('[data-cy="study-browser-thumbnail"]').first()).toBeVisible({ timeout: 90_000 });
  expect(await tourShows(viewer), 'tour after reload').toBe(false);
  await viewer.context().close();
});
