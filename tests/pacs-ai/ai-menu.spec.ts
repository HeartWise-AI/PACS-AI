import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { apiCall } from './support/api';
import { AI_BUTTON, menuModels, openAiMenu, openViewer } from './support/viewer';

/**
 * The run-model menu offers the models of the open exam's modality: PanEcho
 * on an echo, the angio models on an XA study.
 *
 * api-pacs lists only the model containers that answer at that moment, so a
 * container busy with a prediction can be missing from the list the viewer
 * loads (owner report: an echo PanEcho had just processed showed "No
 * inference models found"). Opening the menu must ask again and bring the
 * model back.
 */

const AVAILABLE = '**/v1/inference/model/proxy/available';

/** Most recent locally stored study with this modality, or null (Orthanc answers 400 to limit= with this filter). */
async function recentLocalStudy(page: Page, modality: 'US' | 'XA'): Promise<string | null> {
  const res = await apiCall<any[]>(
    page,
    'GET',
    `/proxy/orthanc/dicom-web/studies?ModalitiesInStudy=${modality}&includefield=00080020`
  );
  if (res.status !== 200 || !Array.isArray(res.json) || !res.json.length) return null;
  const studies = res.json
    .map(s => ({ uid: s['0020000D']?.Value?.[0], date: s['00080020']?.Value?.[0] ?? '' }))
    .filter(s => s.uid)
    .sort((a, b) => b.date.localeCompare(a.date));
  return studies[0]?.uid ?? null;
}

const cases = [
  { modality: 'US' as const, expected: /^PanEcho\b/ },
  { modality: 'XA' as const, expected: /^DeepCORO-JEPA\b/ },
];

for (const { modality, expected } of cases) {
  test(`the run-model menu offers the ${modality} models`, async ({ page }) => {
    await page.goto('/');
    const uid = await recentLocalStudy(page, modality);
    test.skip(!uid, `no ${modality} study stored locally`);
    await openViewer(page, uid!);
    await openAiMenu(page);
    const names = (await menuModels(page)).map(m => m.name);
    expect(names.some(n => expected.test(n)), names.join(', ')).toBe(true);
  });
}

test('a model left out of the first list comes back when the menu opens', async ({ page }) => {
  await page.goto('/');
  const uid = await recentLocalStudy(page, 'US');
  test.skip(!uid, 'no echo study stored locally');

  // Every list the page loads before the menu opens sees PanEcho's container
  // busy: api-pacs leaves it out.
  let menuOpened = false;
  let callsAfterOpen = 0;
  await page.route(AVAILABLE, async route => {
    if (menuOpened) callsAfterOpen += 1;
    const response = await route.fetch();
    const body = await response.json();
    const list = Array.isArray(body) ? body : body.data;
    const filtered = menuOpened ? list : list.filter((m: any) => m.modelName !== 'PanEcho');
    await route.fulfill({ response, json: Array.isArray(body) ? filtered : { ...body, data: filtered } });
  });

  await openViewer(page, uid!);
  await expect(page.locator(AI_BUTTON).first()).toBeEnabled({ timeout: 30_000 });
  menuOpened = true;
  await page.locator(AI_BUTTON).first().click();
  await expect(
    page.locator('[data-testid="ai-model-previous-result"], li h1').filter({ hasText: /PanEcho/ }).first()
  ).toBeVisible({ timeout: 30_000 });
  expect(callsAfterOpen).toBeGreaterThanOrEqual(1);
});
