import { test, expect, collectPageErrors } from './support/fixtures';
import { apiCall } from './support/api';

/**
 * F3/F4/F24 — admin pages, read-only: nothing is invited, edited, toggled,
 * deployed or deleted. The test account must be a workspace administrator.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  const me = await apiCall<{ data?: { role?: string } }>(page, 'GET', '/v1/user/me');
  test.skip(!['ADMIN', 'OWNER'].includes(me.json?.data?.role ?? ''), 'the test account is not an administrator');
});

test('members list loads', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/admin/members');
  await expect(page).toHaveTitle(/PACS AI/);
  await expect(page.getByPlaceholder('Search member name, email, license no., etc.')).toBeVisible({ timeout: 60_000 });
  for (const header of ['Name', 'Role', 'Email', 'Access Status']) {
    await expect(page.getByText(header, { exact: true }).first()).toBeVisible();
  }
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('Kibana logs page loads', async ({ page }) => {
  await page.goto('/admin/kibana-logs');
  await expect(page).toHaveTitle('Admin Kibana Logs - PACS AI');
});

test('every workspace settings section loads', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/admin/workspace-settings');
  const tabs = page.getByRole('tablist', { name: 'Workspace Settings' }).getByRole('tab');
  await expect(tabs.first()).toBeVisible({ timeout: 60_000 });
  const names = (await tabs.allInnerTexts()).map(t => t.trim());
  expect(names).toEqual(['Onboarding', 'DICOM (Orthanc)', 'Inference Models', 'Ingestion Jobs']);
  for (const name of names) {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const panel = page.locator(`#${await tab.getAttribute('aria-controls')}`);
    await expect(panel).toBeVisible();
    await expect(panel).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});

test('model catalog lists the installed models', async ({ page }) => {
  await page.goto('/ai-models');
  await expect(page.getByText('View More').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/DeepCORO|CathEF|DeepRV|PanEcho/).first()).toBeVisible();
});

test('the GPU management panel shows the GPUs', async ({ page }) => {
  await page.goto('/admin/workspace-settings');
  await page.getByRole('tab', { name: 'Inference Models', exact: true }).click();
  const gpu = page.getByLabel('GPU management').or(page.getByRole('region', { name: 'GPU management' }));
  await expect(gpu.first()).toBeVisible({ timeout: 60_000 });
  await expect(gpu.first()).toContainText(/GPU|RTX|MiB|GB/);
});

test('ingestion jobs show "Created by" and a per-job Notifications switch', async ({ page }) => {
  await page.goto('/admin/workspace-settings');
  await page.getByRole('tab', { name: 'Ingestion Jobs', exact: true }).click();
  await expect(page.locator('[data-testid^="ingestion-job-creator-"]').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Created by').first()).toBeVisible();
  const switches = page.locator('[data-testid^="ingestion-job-notifications-"]');
  await expect(switches.first()).toBeVisible();
  expect(await switches.count()).toBe(await page.locator('[data-testid^="ingestion-job-creator-"]').count());
});
