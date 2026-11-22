import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { xaStudies } from './support/env';
import { goldenRuns } from './support/golden';
import { apiCall } from './support/api';
import { ensureStudyLocal } from './support/studies';
import { PREVIOUS_RESULT, RESULT_DRAWER, openAiMenu, openViewer } from './support/viewer';

/**
 * F6 — stored results in the viewer: the AI menu lists the latest result of
 * each model, "View result" opens the drawer with the report, the drawer
 * says which series the run used and marks the selected views on the
 * thumbnails. Read-only: only stored results are opened.
 */

/** Model names with a stored result for the study, as the backend reports them. */
async function storedModels(page: Page, uid: string): Promise<string[]> {
  const res = await apiCall<{ data?: { results?: Array<{ modelName?: string }> } }>(
    page,
    'GET',
    `/v1/inference/worklist/studies/${encodeURIComponent(uid)}/latest-results`
  );
  expect(res.status, 'latest-results answered').toBe(200);
  return [...new Set((res.json?.data?.results ?? []).map(r => r.modelName ?? '').filter(Boolean))];
}

let stored: string[] = [];

async function openStoredResult(page: Page, model: string): Promise<void> {
  await openAiMenu(page);
  const row = page.locator(PREVIOUS_RESULT).filter({ hasText: new RegExp(`^${model} \\(`) }).first();
  await row.getByRole('button', { name: /^View result/ }).click();
  await expect(page.locator(RESULT_DRAWER)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`${RESULT_DRAWER} #viewer-model-result-title`)).toContainText(model);
}

async function closeDrawer(page: Page): Promise<void> {
  await page.getByTestId('viewer-model-result-close').click();
  await expect(page.locator(RESULT_DRAWER)).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  await openViewer(page, study.uid);
  stored = await storedModels(page, study.uid);
  // PLAN.md section 8 expected stored results of six models on each reference
  // study; results expire with the server's retention, and run-model.spec
  // (which runs before this spec) creates fresh ones.
  test.skip(!stored.length, `no stored AI result on ${study.tag} (expired); run run-model.spec first`);
});

test('the AI menu lists the stored results of the reference models', async ({ page }) => {
  await openAiMenu(page);
  const labels = (await page.locator(PREVIOUS_RESULT).allInnerTexts()).map(t => t.split('\n')[0]);
  for (const model of stored) {
    expect(labels.some(l => l.startsWith(`${model} (`)), `menu row with the stored result of ${model}`).toBe(true);
  }
  expect(labels.length, 'one row per model with a stored result').toBe(stored.length);
  await expect(page.locator(PREVIOUS_RESULT).first().getByRole('button', { name: /^View result · / })).toBeVisible();
});

test('opening a stored result shows its report and the series it used', async ({ page }) => {
  const model = stored.includes('DeepRV-CLIP') ? 'DeepRV-CLIP' : stored[0];
  await openStoredResult(page, model);
  await expect(
    page.frameLocator('[data-testid="viewer-model-result-report"]').locator('body').or(page.getByText(/RESULT DATA/i))
  ).not.toBeEmpty({ timeout: 60_000 });
  const scope = page.getByTestId('viewer-model-result-series-scope');
  await expect(scope).toBeVisible();
  await expect(scope).toHaveText(/\d+ of \d+ series|All series|\d+ series/);
  await scope.hover();
  await expect(page.getByTestId('viewer-model-result-series-list')).toBeAttached();
  await closeDrawer(page);
});

test('stored report text matches the golden output of the reference run', async ({ page }) => {
  const tag = xaStudies()[0].tag;
  const golden = goldenRuns().find(g => g.study === tag && g.model.startsWith('CathEF-CLIP ('));
  test.skip(!golden, 'PACS_AI_E2E_GOLDEN_DIR not set or no CathEF-CLIP golden output for this study');
  test.skip(!stored.includes('CathEF-CLIP'), 'no stored CathEF-CLIP result on the study');
  await openStoredResult(page, 'CathEF-CLIP');
  const report = page.frameLocator('[data-testid="viewer-model-result-report"]').locator('body');
  await expect(report).not.toBeEmpty({ timeout: 60_000 });
  // The latest stored result may be newer than the golden run, but a model's
  // report for the same input is identical; equal text proves the renderer.
  expect((await report.innerText()).trim()).toBe(golden!.text.trim());
});

test('selected views of a result are badged on the study browser thumbnails', async ({ page }) => {
  for (const model of stored) {
    await openStoredResult(page, model);
    // The section says "Views not recorded for this run" when the model
    // reports no selected views.
    await expect(page.getByTestId('viewer-model-result-selected-views')).toBeVisible();
    if (await page.getByTestId('viewer-model-result-selected-view').count()) {
      await expect(page.locator('[data-cy="thumbnail-selected-view-badge"]').first()).toBeVisible();
      return;
    }
    await closeDrawer(page);
  }
  test.skip(true, `none of the stored results (${stored.join(', ')}) recorded selected views`);
});
