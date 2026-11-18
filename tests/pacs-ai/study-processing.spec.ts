import { test, expect } from './support/fixtures';
import { WORKLIST_ROW, searchReferenceDateRange } from './support/worklist';
import { apiCall } from './support/api';

/**
 * F7 — study processing on the work list: per-study status (REST snapshot and
 * SSE), run history in the expanded row, the notifications bell, and the
 * "Reprocess study" action for operators. Reprocess is only checked for
 * presence; it is never clicked (live server).
 */

const ROW = WORKLIST_ROW;
const searchDateRange = searchReferenceDateRange;

// Processing column = 8th cell of a row: a status cell when the study has
// processing data, otherwise a "No status yet" status.

test('each listed study shows its processing status', async ({ page }) => {
  await searchDateRange(page);
  await expect(page.locator('thead th', { hasText: /^Processing$/ })).toBeVisible();
  const rows = await page.locator(ROW).count();
  const withStatus = page
    .locator(ROW)
    .filter({ has: page.locator('td:nth-child(8) [role="status"], td:nth-child(8) [data-testid="study-processing-status-cell"]') });
  await expect(withStatus, 'rows with a processing status').toHaveCount(rows, { timeout: 60_000 });
  const withData = await page.getByTestId('study-processing-status-cell').count();
  test.info().annotations.push({ type: 'note', description: `${withData} of ${rows} studies have processing data` });
  if (withData) await expect(page.getByTestId('study-processing-status-label').first()).toBeVisible();
});

test('status updates arrive over the processing event stream', async ({ page }) => {
  await searchDateRange(page);
  // The banner only shows when the live connection is down or stale.
  await page.waitForTimeout(5_000);
  await expect(page.getByText('Live processing updates are unavailable.')).toHaveCount(0);
  await expect(page.getByText('Reconnecting to live processing updates…')).toHaveCount(0);
  // The stream the work list listens to answers as an event stream.
  const stream = await page.evaluate(async () => {
    const base = (window as any)._env_?.APP_PUBLIC_API_URL ?? '/api';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4_000);
    try {
      const res = await fetch(`${base}/v1/inference/worklist/events`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
        signal: controller.signal,
      });
      return { status: res.status, type: res.headers.get('content-type') ?? '' };
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  });
  expect(stream.status).toBe(200);
  expect(stream.type).toMatch(/text\/event-stream/);
});

test('the expanded row shows the run history and offers Reprocess to operators', async ({ page }) => {
  await searchDateRange(page);
  const me = await apiCall<{ data?: { role?: string } }>(page, 'GET', '/v1/user/me');
  await page.locator(ROW).first().click();
  const history = page.getByRole('region', { name: 'Processing run history' }).or(
    page.locator('section[aria-label="Processing run history"]')
  );
  await expect(history.first()).toBeVisible({ timeout: 60_000 });
  await expect(history.first().getByText(/\d+ runs?/)).toBeVisible({ timeout: 60_000 });
  const isOperator = ['ADMIN', 'OWNER'].includes(me.json?.data?.role ?? '');
  const reprocess = page.getByTestId('study-processing-reprocess-action');
  if (isOperator) {
    await expect(reprocess.first()).toBeVisible();
    await expect(reprocess.first()).toHaveText(/Reprocess study/);
  } else {
    await expect(reprocess).toHaveCount(0);
  }
});

test('the notifications bell opens the processing notifications', async ({ page }) => {
  await page.goto('/');
  const bell = page.getByRole('button', { name: 'Processing notifications' });
  await expect(bell).toBeVisible({ timeout: 60_000 });
  await bell.click();
  await expect(page.getByText('Processing notifications').last()).toBeVisible();
});
