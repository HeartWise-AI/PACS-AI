import { test, expect } from './support/fixtures';
import { env, xaStudies } from './support/env';
import { apiCall } from './support/api';
import { ensureStudyLocal } from './support/studies';
import { PREVIOUS_RESULT, openAiMenu, openViewer } from './support/viewer';

/**
 * F18/F21 — running-jobs card, bell and notification audience.
 *
 * The run-and-cancel check starts a model run on a reference study from the
 * viewer and cancels it from the card; it uses GPU time, so it only runs with
 * PACS_AI_E2E_ALLOW_EXTRA_RUNS=1. The mute toggle changes the test user's own
 * preference and only runs with PACS_AI_E2E_ALLOW_USER_PREFS=1 (restored).
 */

const SERIES_DIALOG = '[role="dialog"][aria-labelledby="modal-title"]';

test('the Settings toggle reflects the stored "notify about automatic analyses" preference', async ({ page }) => {
  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Notify me about automatic analyses' });
  await expect(toggle).toBeVisible({ timeout: 60_000 });
  await expect(toggle).toBeEnabled({ timeout: 30_000 });
  const metadata = await apiCall<{ data?: { metadata?: Record<string, unknown> } }>(page, 'GET', '/v1/user/metadata');
  expect(metadata.status).toBe(200);
  const stored = metadata.json?.data?.metadata?.notifyAutomaticRuns !== false;
  await expect(toggle).toHaveAttribute('aria-checked', String(stored));
});

test('the Settings toggle mutes automatic notifications and is restored', async ({ page }) => {
  test.skip(!env.allowUserPrefs, 'changes the test user\'s own preference; set PACS_AI_E2E_ALLOW_USER_PREFS=1');
  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Notify me about automatic analyses' });
  await expect(toggle).toBeEnabled({ timeout: 60_000 });
  const initial = (await toggle.getAttribute('aria-checked')) === 'true';
  try {
    const saved = page.waitForResponse(r => r.url().includes('/v1/user/metadata/update'));
    await toggle.click();
    expect((await saved).status()).toBeLessThan(300);
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Notify me about automatic analyses' })).toHaveAttribute(
      'aria-checked',
      String(!initial),
      { timeout: 30_000 }
    );
  } finally {
    const current = page.getByRole('switch', { name: 'Notify me about automatic analyses' });
    await expect(current).toBeEnabled({ timeout: 30_000 });
    if ((await current.getAttribute('aria-checked')) !== String(initial)) await current.click();
    await expect(current).toHaveAttribute('aria-checked', String(initial));
  }
});

test('a regular user gets no toast for automatic runs', async () => {
  // Needs a non-admin account and an automatic (ingestion) run finishing
  // during the test; neither can be produced on the live server without
  // changing ingestion settings. Covered by notificationAudience.test.ts.
  test.skip(true, 'not reproducible on the live server without changing ingestion jobs (tested by design)');
});

test('a run shows the running-jobs card with counts, cancels from the card, and the bell opens the exam', async ({
  page,
}) => {
  test.skip(!env.allowExtraRuns, 'starts and cancels a GPU run; set PACS_AI_E2E_ALLOW_EXTRA_RUNS=1');
  test.setTimeout(10 * 60_000);
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  await openViewer(page, study.uid);
  await openAiMenu(page);
  const row = page.locator(PREVIOUS_RESULT).filter({ hasText: /^DeepRV-CLIP \(/ }).first();
  await row.getByRole('button', { name: /^Rerun$/ }).click();
  await row.getByRole('button', { name: /^Rerun$/ }).click();
  const dialog = page.locator(SERIES_DIALOG);
  await expect(dialog.locator('#first-series-count')).toBeVisible({ timeout: 60_000 });
  await dialog.getByRole('button', { name: 'Select', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  const background = page.getByRole('button', { name: 'Continue in background' });
  if (await background.isVisible({ timeout: 10_000 }).catch(() => false)) await background.click();

  const card = page.getByTestId('running-jobs-indicator');
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByTestId('running-jobs-row').first()).toBeVisible();
  await expect(card.getByTestId('running-jobs-count').first()).toHaveText(/\d/);
  await card.getByTestId('running-jobs-cancel').first().click();
  await expect(card.getByTestId('running-jobs-cancel-confirm')).toBeVisible();
  await card.getByTestId('running-jobs-cancel-yes').click();
  await expect(card.getByTestId('running-jobs-state').first()).toHaveText(/Cancel/i, { timeout: 120_000 });

  const bell = page.getByRole('button', { name: 'Processing notifications' });
  await bell.click();
  const entry = page.locator('button.block.w-full').first();
  await expect(entry).toBeVisible({ timeout: 120_000 });
  await entry.click();
  await expect(page).toHaveURL(new RegExp(`/viewer\\?.*StudyInstanceUIDs=${study.uid.replace(/\./g, '\\.')}`));
});
