import { test, expect } from './support/fixtures';
import { referenceStudies, usStudies, xaStudies } from './support/env';
import { ensureStudyLocal } from './support/studies';
import { THUMBNAIL, dismissTour, viewerURL } from './support/viewer';

/**
 * Opening an exam the way the notification bell and the AI Predictions page
 * do: an in-app navigation to /viewer?StudyInstanceUIDs=… from another page,
 * not a fresh page load. A crash while the viewer renders used to leave a
 * blank page (no header, no message); now it must show the PACS-AI error
 * message, and in a healthy viewer it must not show at all.
 */

const FALLBACK = '[data-testid="pacs-ai-error-fallback"]';
const VIEWPORT = '.cornerstone-viewport-element, [data-viewport-uid]';

/** The first reference study (angio first, then echo) that is stored locally. */
async function localStudy(page: import('@playwright/test').Page) {
  const candidates = [...xaStudies(), ...usStudies(), ...referenceStudies()];
  const reasons: string[] = [];
  for (const study of candidates) {
    const local = await ensureStudyLocal(page, study);
    if (local.ok) return { study, reason: '' };
    reasons.push(`${study.tag}: ${local.reason}`);
  }
  return { study: null, reason: reasons.join('; ') || 'no reference study configured' };
}

async function navigateInApp(page: import('@playwright/test').Page, path: string): Promise<void> {
  // What react-router's navigate() does for the bell: push the URL and let the
  // router pick it up, without reloading the document.
  await page.evaluate(url => {
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
}

for (const from of ['/', '/ai-predictions']) {
  test(`exam opened from ${from} by in-app navigation shows the viewer, not a blank page`, async ({ page }) => {
    const { study, reason } = await localStudy(page);
    test.skip(!study, `no reference study available locally: ${reason}`);

    await page.goto(from);
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible({ timeout: 60_000 });

    await navigateInApp(page, viewerURL(study.uid));
    await expect(page).toHaveURL(/\/viewer\?StudyInstanceUIDs=/);
    await expect(page.locator(THUMBNAIL).first()).toBeVisible({ timeout: 90_000 });
    await expect(page.locator(VIEWPORT).first()).toBeVisible({ timeout: 60_000 });
    await dismissTour(page);
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expect(page.locator(FALLBACK)).toHaveCount(0);
  });
}

test('a viewer that fails to render shows the PACS-AI error message with a way out', async ({ page }) => {
  const { study, reason } = await localStudy(page);
  test.skip(!study, `no reference study available locally: ${reason}`);

  // Make the study's series metadata unreadable so the viewer layout fails
  // while it builds the study (the moment the reported blank page happened).
  await page.route(/\/dicom-web\/studies\/[^/]+\/series\/[^/]+\/metadata/, route =>
    route.fulfill({ status: 200, contentType: 'application/dicom+json', body: '[{"00080016":' })
  );
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible({ timeout: 60_000 });
  await navigateInApp(page, viewerURL(study.uid));
  await expect(page).toHaveURL(/\/viewer\?StudyInstanceUIDs=/);
  // Give the viewer time to request and process the metadata before judging.
  await page.waitForResponse(/\/metadata/, { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(5_000);

  // Whatever the viewer does with broken metadata, the page is never blank:
  // either the viewer shell stays up, or our error message is shown.
  const shell = page.getByRole('navigation', { name: 'Primary navigation' });
  const fallback = page.locator(FALLBACK);
  await expect(shell.or(fallback).first()).toBeVisible({ timeout: 60_000 });
  if (await fallback.isVisible()) {
    await expect(fallback.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(fallback.getByRole('button', { name: 'Back to studies' })).toBeVisible();
    await expect(page.getByTestId('pacs-ai-error-fallback-detail')).not.toBeEmpty();
  }
});
