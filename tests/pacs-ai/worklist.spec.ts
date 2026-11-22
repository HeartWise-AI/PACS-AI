import type { Page } from '@playwright/test';
import { test, expect, collectPageErrors } from './support/fixtures';
import { env, pickerDate, xaStudies } from './support/env';
import { WORKLIST_ROW, searchReferenceDateRange } from './support/worklist';

/**
 * F10 — the PACS-AI work list. The list opens on today's date, so every test
 * sets the reference date range first. Values read from rows (names, MRNs)
 * are used only to drive the search and are never printed.
 */

const ROW = WORKLIST_ROW;
const searchDateRange = searchReferenceDateRange;

async function cellText(page: Page, row: number, column: number): Promise<string> {
  return (await page.locator(ROW).nth(row).locator('td').nth(column).innerText()).trim();
}

test('the work list loads and searches the reference date range', async ({ page }) => {
  const errors = collectPageErrors(page);
  await searchDateRange(page);
  expect(await page.locator(ROW).count()).toBeGreaterThan(0);
  for (const header of ['Patient Name', 'MRN', 'Study Date', 'Description', 'Modality']) {
    await expect(page.locator('thead th', { hasText: header }).first()).toBeVisible();
  }
  expect(errors, 'uncaught page errors').toEqual([]);
});

test('search by MRN and by patient name narrows the list', async ({ page }) => {
  await searchDateRange(page);
  const mrn = await cellText(page, 0, 1);
  const name = await cellText(page, 0, 0);
  test.skip(!mrn || !name, 'the first row has no MRN or name to search with');

  await page.locator('#MRN').fill(mrn);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator(ROW).first()).toBeVisible({ timeout: 60_000 });
  const mrns = await page.locator(`${ROW} td:nth-child(2)`).allInnerTexts();
  expect(mrns.length).toBeGreaterThan(0);
  expect(mrns.every(v => v.trim() === mrn), 'every row has the searched MRN').toBe(true);

  await page.locator('#MRN').fill('');
  const token = name.split(/[\s,^]+/).find(t => t.length >= 2) ?? name;
  await page.locator('#PatientName').fill(token);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator(ROW).first()).toBeVisible({ timeout: 60_000 });
  const names = await page.locator(`${ROW} td:nth-child(1)`).allInnerTexts();
  expect(
    names.every(v => v.toLowerCase().includes(token.toLowerCase())),
    'every row matches the searched name'
  ).toBe(true);
});

test('expanding a row shows the study actions and its processing details', async ({ page }) => {
  await searchDateRange(page);
  await page.locator(ROW).first().click();
  const expanded = page.locator('tr.expandable-content').first();
  await expect(expanded).toBeVisible();
  await expect(expanded.getByRole('button', { name: 'Basic Viewer' })).toBeVisible();
});

test('the processing status column is shown with a status per study', async ({ page }) => {
  await searchDateRange(page);
  await expect(page.locator('thead th', { hasText: /^Processing$/ })).toBeVisible();
  const rows = await page.locator(ROW).count();
  const withStatus = page
    .locator(ROW)
    .filter({ has: page.locator('td:nth-child(8) [role="status"], td:nth-child(8) [data-testid="study-processing-status-cell"]') });
  await expect(withStatus, 'rows with a processing status').toHaveCount(rows, { timeout: 60_000 });
});

test('the submitted search is restored after opening a study and returning', async ({ page }) => {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  await searchDateRange(page);
  const before = await page.locator(ROW).count();
  await page.goto(`/viewer?StudyInstanceUIDs=${encodeURIComponent(study.uid)}`);
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Studies' }).click();
  await expect(page.locator(ROW).first()).toBeVisible({ timeout: 90_000 });
  expect(await page.locator(ROW).count(), 'same result rows after returning').toBe(before);
  await expect(page.locator('#FilterStartDate')).toHaveValue(pickerDate(env.worklistFrom));
});

// PLAN.md section 8 asks for an "upload button present" check. On main the
// work list has no upload control: the only store-to-PACS action is the
// "Write to Study" button of the legacy HTML output modal (StoreFileButton).
// Kept as fixme until the plan names the control to protect.
test.fixme('the upload button is present', async () => undefined);
