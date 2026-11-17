import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { env, xaStudies } from './support/env';
import { apiCall } from './support/api';
import { fillAndSubmitLogin, loginURL } from './support/auth';

/**
 * F23 — the AI Predictions page. Read-only: "Run again", "Cancel" and
 * "Retrieve from PACS and open" are checked for presence only.
 */

const EXAM = '[data-testid="ai-predictions-exam"]';

async function openPage(page: Page): Promise<void> {
  await page.goto('/ai-predictions');
  await expect(page.getByRole('main').getByRole('heading', { name: 'AI Predictions', level: 1 })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator(EXAM).first().or(page.getByTestId('ai-predictions-empty'))).toBeVisible({ timeout: 60_000 });
}

async function chooseView(page: Page, label: 'My runs' | 'Automatic runs' | 'All runs') {
  const group = page.getByRole('group', { name: 'Whose runs' });
  const button = group.getByRole('button', { name: new RegExp(`^${label}`) });
  await expect(button).toBeVisible();
  if ((await button.getAttribute('aria-pressed')) === 'true') {
    // Already shown: switch away and back so the page fetches this view again.
    const other = label === 'My runs' ? 'Automatic runs' : 'My runs';
    await group.getByRole('button', { name: new RegExp(`^${other}`) }).click();
    await expect(group.getByRole('button', { name: new RegExp(`^${other}`) })).toHaveAttribute('aria-pressed', 'true');
  }
  const response = page.waitForResponse(
    r => /\/v1\/inference\/predictions(\?|$)/.test(r.url()) && r.request().method() === 'GET',
    { timeout: 60_000 }
  );
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  return response;
}

/** Narrows the page to the first XA reference exam (search by its accession suffix from the tag). */
async function showReferenceExam(page: Page): Promise<void> {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const suffix = study.tag.split('_')[1];
  test.skip(!suffix || !/^\d+$/.test(suffix), 'the XA tag does not end with an accession suffix');
  await chooseView(page, 'All runs');
  const response = page.waitForResponse(r => /\/v1\/inference\/predictions\?/.test(r.url()), { timeout: 60_000 });
  await page.getByLabel(/^Patient, MRN or accession/).fill(suffix);
  await page.keyboard.press('Enter');
  await response;
  await expect(page.locator(EXAM).first()).toBeVisible({ timeout: 60_000 });
}

test.beforeEach(async ({ page }) => {
  await openPage(page);
});

test('the page loads with My, Automatic and All runs', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Whose runs' });
  await expect(group.getByRole('button', { name: 'My runs' })).toBeVisible();
  await expect(group.getByRole('button', { name: 'Automatic runs' })).toBeVisible();
  for (const label of ['My runs', 'Automatic runs'] as const) {
    const res = await chooseView(page, label);
    expect(res.status()).toBe(200);
  }
  const me = await apiCall<{ data?: { role?: string } }>(page, 'GET', '/v1/user/me');
  const isAdmin = ['ADMIN', 'OWNER'].includes(me.json?.data?.role ?? '');
  if (!isAdmin) {
    await expect(group.getByRole('button', { name: /^All runs/ }), 'All runs hidden from a regular user').toHaveCount(0);
    return;
  }
  await expect(group.getByRole('button', { name: /^All runs/ }), 'All runs offered to an administrator').toBeVisible();
  const all = await chooseView(page, 'All runs');
  expect(all.status()).toBe(200);
  await expect(page.getByText(/is shown to workspace administrators only/)).toBeVisible();
  await expect(page.locator(EXAM).first().or(page.getByTestId('ai-predictions-empty'))).toBeVisible({ timeout: 60_000 });
});

test('All runs is refused (403) to a regular user', async ({ browser }) => {
  test.skip(!env.regularUser || !env.regularPassword, 'set PACS_AI_E2E_REGULAR_USER/_PASSWORD to check the 403');
  const context = await browser.newContext({ baseURL: env.baseURL, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(loginURL());
  await fillAndSubmitLogin(page, env.regularUser, env.regularPassword);
  await page.waitForFunction(() => !!localStorage.getItem('sessionToken'), null, { timeout: 60_000 });
  const res = await apiCall(page, 'GET', '/v1/inference/predictions?view=all');
  expect(res.status).toBe(403);
  await context.close();
});

test('filters narrow the list', async ({ page }) => {
  await chooseView(page, 'All runs');
  const response = page.waitForResponse(r => /\/v1\/inference\/predictions\?/.test(r.url()), { timeout: 60_000 });
  await page.getByLabel(/^Patient, MRN or accession/).fill('zz-no-such-exam-e2e');
  await page.keyboard.press('Enter');
  expect(new URL((await response).url()).searchParams.toString()).toMatch(/zz-no-such-exam-e2e/);
  await expect(page.getByTestId('ai-predictions-empty')).toBeVisible({ timeout: 60_000 });

  await page.getByLabel(/^Patient, MRN or accession/).fill('');
  const model = page.getByLabel('Model', { exact: true });
  const options = await model.locator('option').allInnerTexts();
  expect(options.length, 'model filter offers models').toBeGreaterThan(1);
  const byModel = page.waitForResponse(r => /\/v1\/inference\/predictions\?/.test(r.url()), { timeout: 60_000 });
  await model.selectOption({ index: 1 });
  expect((await byModel).status()).toBe(200);
  await page.getByLabel('Status', { exact: true }).selectOption('completed');
  await expect(page.locator(EXAM).first().or(page.getByTestId('ai-predictions-empty'))).toBeVisible({ timeout: 60_000 });
});

test('expanding an exam shows key results; an earlier run compares with the latest', async ({ page }) => {
  await showReferenceExam(page);
  const exam = page.locator(EXAM).first();
  await exam.locator('button[aria-expanded="false"]').first().click();
  await expect(page.getByTestId('ai-predictions-key-result').first()).toBeVisible({ timeout: 60_000 });

  const earlier = page.getByRole('button', { name: /\d+ earlier runs?/ }).first();
  await expect(earlier).toBeVisible();
  await earlier.click();
  const compare = page.getByRole('button', { name: 'Compare with latest' }).first();
  await expect(compare).toBeVisible({ timeout: 60_000 });
  await compare.click();
  const dialog = page.getByRole('dialog', { name: 'Compare with latest' });
  await expect(dialog).toBeVisible();
  // Either a field-by-field table or the two raw results side by side.
  const comparison = dialog.locator('table').or(dialog.locator('section[aria-label="Latest run"]'));
  const failure = dialog.getByRole('alert');
  await expect(comparison.first().or(failure.first()), 'comparison loaded or failed').toBeVisible({ timeout: 60_000 });
  expect(await failure.count() ? await failure.first().innerText() : '', 'comparison loads without error').toBe('');
  await expect(comparison.first()).toBeVisible();
  await expect(dialog.getByText('Earlier run').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
});

test('CSV export downloads one line per model run', async ({ page }) => {
  await chooseView(page, 'My runs');
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Export CSV (one line per model run)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const path = await file.path();
  const firstLine = fs.readFileSync(path, 'utf8').split(/\r?\n/)[0];
  expect(firstLine.split(',').length, 'CSV header columns').toBeGreaterThan(3);
  await expect(page.getByText('Export saved.')).toBeVisible();
  fs.rmSync(path, { force: true });
});

test('an exam whose images were removed offers "Retrieve from PACS and open"', async ({ page }) => {
  await chooseView(page, 'All runs');
  const removed = page.locator(EXAM).filter({ has: page.getByTestId('ai-predictions-images-removed') }).first();
  const found = await removed.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true).catch(() => false);
  test.skip(!found, 'no exam with removed images on the first page');
  await expect(removed.getByRole('button', { name: 'Retrieve from PACS and open' })).toBeVisible();
});
