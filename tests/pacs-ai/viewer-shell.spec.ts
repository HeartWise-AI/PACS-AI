import { test, expect, collectPageErrors } from './support/fixtures';
import { xaStudies } from './support/env';
import { ensureStudyLocal } from './support/studies';
import { AI_BUTTON, THUMBNAIL, openViewer } from './support/viewer';

/** F5/F8/F11/F12 — the viewer shell PACS-AI puts around OHIF. */

test.beforeEach(async ({ page }) => {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  await openViewer(page, study.uid);
});

test('document title is the PACS-AI viewer title', async ({ page }) => {
  await expect(page).toHaveTitle('Viewer - PACS AI');
});

test('PACS-AI top navigation is shown in the viewer', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav).toBeVisible();
  for (const item of ['Studies', 'AI Models', 'AI Predictions']) {
    await expect(nav.getByRole('link', { name: item })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Account menu' }).first()).toBeVisible();
  // AI models and chat sit in the viewer header.
  await expect(page.locator(AI_BUTTON).first()).toBeVisible();
  await expect(page.getByTitle('Toggle Chat (Ctrl+/)')).toBeVisible();
});

test('study browser shows thumbnails for the study', async ({ page }) => {
  const errors = collectPageErrors(page);
  expect(await page.locator(THUMBNAIL).count()).toBeGreaterThan(1);
  await expect(page.locator('[data-cy="study-browser-thumbnail"] img, [data-cy="study-browser-thumbnail"] canvas').first()).toBeVisible({
    timeout: 60_000,
  });
  expect(errors).toEqual([]);
});

test('no upstream OHIF header chrome', async ({ page }) => {
  // Upstream's header shows "return to work list" with the OHIF logo and a
  // settings menu (About, Preferences); PACS-AI replaces them.
  await expect(page.locator('[data-cy="return-to-work-list"]')).toHaveCount(0);
  await expect(page.getByText(/INVESTIGATIONAL USE ONLY/i)).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /^(About|Preferences)$/ })).toHaveCount(0);
});
