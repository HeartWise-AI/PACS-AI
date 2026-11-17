import { expect, type Page } from '@playwright/test';
import { env, pickerDate } from './env';

export const WORKLIST_ROW = 'tbody tr.expandable-row';

/**
 * Opens the work list and searches the reference date range. The list opens
 * on today's date; the range picker (react-dates) only accepts typed input,
 * so the dates are typed rather than filled.
 */
export async function searchReferenceDateRange(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#PatientName')).toBeVisible({ timeout: 60_000 });
  // Let the default (today) search settle before changing the range: its
  // result would otherwise reset the typed dates.
  await expect(page.locator(WORKLIST_ROW).first().or(page.getByText(/^No data found\./))).toBeVisible({
    timeout: 60_000,
  });
  await page.waitForTimeout(1_000);
  await typeDate(page, '#FilterStartDate', pickerDate(env.worklistFrom));
  await typeDate(page, '#FilterEndDate', pickerDate(env.worklistTo));
  await page.keyboard.press('Escape');
  await expect(page.locator('#FilterStartDate')).toHaveValue(pickerDate(env.worklistFrom));
  await expect(page.locator('#FilterEndDate')).toHaveValue(pickerDate(env.worklistTo));
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator(WORKLIST_ROW).first()).toBeVisible({ timeout: 90_000 });
}

async function typeDate(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
}
