import { test, expect } from './support/fixtures';
import { xaStudies } from './support/env';
import { ensureStudyLocal, localSeriesCount } from './support/studies';
import { apiCall } from './support/api';
import { RESULT_DRAWER, THUMBNAIL, openViewer } from './support/viewer';

/**
 * F19 — "Refresh study from PACS" retrieves the study and reloads its series
 * in place (no page reload). F20 — chat answers cite model results with [n]
 * chips that open the result. Both act only on a reference study.
 */

test.beforeEach(async ({ page }, testInfo) => {
  let study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  if (testInfo.title.startsWith('Refresh')) {
    // The refresh re-sends the whole study from the PACS: use the smallest
    // reference study to keep the PACS transfer short.
    await page.goto('/settings');
    const sizes = await Promise.all(xaStudies().map(async s => ({ s, n: await localSeriesCount(page, s.uid) })));
    study = sizes.filter(x => x.n > 0).sort((a, b) => a.n - b.n)[0]?.s ?? study;
  }
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  await openViewer(page, study.uid);
});

test('Refresh study from PACS updates the series in place without reloading the viewer', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const before = await page.locator(THUMBNAIL).count();
  await page.evaluate(() => ((window as any).__pacsAiE2eMarker = true));
  const button = page.getByTestId('study-refresh-button');
  await expect(button).toBeVisible();
  const retrieve = page.waitForRequest(r => r.url().includes('/v1/orthanc/modality/retrieve') && r.method() === 'POST');
  await button.click();
  await retrieve;
  const status = page.getByTestId('study-refresh-status');
  // Progress ("Retrieving… n%", "Loading series…") ends with an outcome.
  await expect(status, 'refresh outcome').toHaveText(/new series|new images?|Up to date|failed/, { timeout: 11 * 60_000 });
  await expect(status, 'the retrieve from the PACS succeeded').not.toHaveText(/failed/, { timeout: 1_000 });
  expect(await page.evaluate(() => (window as any).__pacsAiE2eMarker === true), 'no page reload').toBe(true);
  expect(await page.locator(THUMBNAIL).count(), 'series kept or added in place').toBeGreaterThanOrEqual(before);
});

test('a chat answer cites model results with [n] chips that open the result', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const latest = await apiCall<{ data?: { results?: unknown[] } }>(
    page,
    'GET',
    `/v1/inference/worklist/studies/${encodeURIComponent(xaStudies()[0].uid)}/latest-results`
  );
  test.skip(!latest.json?.data?.results?.length, 'no stored AI result on the study for the answer to cite');
  await page.getByTitle('Toggle Chat (Ctrl+/)').click();
  const input = page.getByPlaceholder('Type your message...').filter({ visible: true }).last();
  await expect(input).toBeVisible();
  await input.fill('Summarize the main findings of the AI results for this study.');
  await input.press('Enter');
  await expect(page.locator('[data-cy="chat-activity-summary"]').last()).toBeVisible({ timeout: 4 * 60_000 });
  const chips = page.locator('[data-cy="chat-citation-chip"]');
  await expect(chips.first(), 'citation chips in the answer').toBeVisible({ timeout: 30_000 });
  await expect(chips.first()).toHaveText(/\d+/);
  await chips.first().click();
  const popover = page.locator('[data-cy="chat-citation-popover"]').last();
  await expect(popover).toBeVisible();
  const open = popover.locator('[data-cy="chat-citation-open-result"]');
  if (await open.count()) {
    await expect(open).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 });
    await open.click();
    await expect(page.locator(RESULT_DRAWER)).toBeVisible({ timeout: 30_000 });
  } else {
    // A web source citation links out instead of opening a model result.
    await expect(popover.locator('[data-cy="chat-citation-link"]')).toBeVisible();
  }
});
