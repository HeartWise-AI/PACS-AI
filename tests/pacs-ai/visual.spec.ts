import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { test, expect } from './support/fixtures';
import { env, xaStudies } from './support/env';
import { searchReferenceDateRange } from './support/worklist';
import { ensureStudyLocal } from './support/studies';
import { PREVIOUS_RESULT, RESULT_DRAWER, openAiMenu, openViewer } from './support/viewer';

/**
 * F11/F12 — screens compared with the baseline taken on main (OHIF 3.11.1)
 * in PACS_AI_E2E_BASELINE_DIR on the host. The baseline holds patient data:
 * it is only read, and no screenshot or diff is written anywhere (the
 * comparison happens in memory). Dynamic regions (versions, times, live
 * status, cine frames, run timestamps) are blanked in both images before
 * comparing. Tolerance: PACS_AI_E2E_VISUAL_MAX_DIFF_RATIO (default 0.02 of
 * the pixels, pixelmatch threshold 0.1), set once in phase 0.
 */

const MAX_DIFF_RATIO = Number(process.env.PACS_AI_E2E_VISUAL_MAX_DIFF_RATIO || 0.02);

test.use({ viewport: { width: 1600, height: 900 }, locale: 'en-CA', timezoneId: 'America/Toronto' });

test.beforeEach(() => {
  test.skip(!env.baselineDir || !fs.existsSync(env.baselineDir), 'PACS_AI_E2E_BASELINE_DIR is not set or missing');
});

type Box = { x: number; y: number; width: number; height: number };

async function boxesOf(page: Page, masks: Locator[]): Promise<Box[]> {
  const boxes: Box[] = [];
  for (const mask of masks) {
    for (const el of await mask.all()) {
      const box = await el.boundingBox().catch(() => null);
      if (box) boxes.push(box);
    }
  }
  return boxes;
}

function blank(png: PNG, boxes: Box[]): void {
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(png.width, Math.ceil(b.x + b.width));
    const y1 = Math.min(png.height, Math.ceil(b.y + b.height));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * png.width + x) * 4;
        png.data[i] = 255;
        png.data[i + 1] = 0;
        png.data[i + 2] = 255;
        png.data[i + 3] = 255;
      }
    }
  }
}

async function compareWithBaseline(page: Page, name: string, masks: Locator[] = []): Promise<void> {
  const baselineFile = path.join(env.baselineDir, `${name}.png`);
  test.skip(!fs.existsSync(baselineFile), `no baseline ${name}.png`);
  const expected = PNG.sync.read(fs.readFileSync(baselineFile));
  const actual = PNG.sync.read(await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' }));
  expect(`${actual.width}x${actual.height}`, `${name}: screenshot size`).toBe(`${expected.width}x${expected.height}`);
  const boxes = await boxesOf(page, masks);
  blank(expected, boxes);
  blank(actual, boxes);
  const diff = pixelmatch(expected.data, actual.data, null, expected.width, expected.height, { threshold: 0.1 });
  const ratio = diff / (expected.width * expected.height);
  test.info().annotations.push({ type: 'visual', description: `${name}: ${(ratio * 100).toFixed(2)} % of pixels differ` });
  expect(ratio, `${name}: share of differing pixels (max ${MAX_DIFF_RATIO})`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

const versionFooter = (page: Page) => page.getByText(/^(Backend|Frontend):/).locator('xpath=..');
const toasts = (page: Page) => page.locator('[role="alert"], [data-testid="running-jobs-indicator"]');

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type=email]')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(3_000);
    await compareWithBaseline(page, '01-login', [versionFooter(page)]);
  });
});

test('work list (reference date range)', async ({ page }) => {
  await searchReferenceDateRange(page);
  await page.waitForTimeout(3_000);
  // The rows come from the hospital PACS and change from day to day; the
  // page chrome, filters and table header are compared.
  await compareWithBaseline(page, '10-worklist', [
    page.locator('tbody tr.expandable-row'),
    page.getByRole('button', { name: 'Processing notifications' }),
    toasts(page),
  ]);
});

test('settings', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByTestId('show-viewer-tour-again')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2_000);
  await compareWithBaseline(page, '20-settings', [toasts(page)]);
});

test.describe('viewer', () => {
  test.beforeEach(async ({ page }) => {
    const study = xaStudies()[0];
    test.skip(!study, 'no XA reference study configured');
    const local = await ensureStudyLocal(page, study);
    test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
    await openViewer(page, study.uid);
    await page.waitForTimeout(5_000);
  });

  // Live content: cine frames, the overlay's frame number, the study browser
  // (its series count follows the local store) and live job/notification state.
  const viewerMasks = (page: Page) => [
    page.locator('.cornerstone-viewport-element'),
    page.locator('[data-cy="viewport-pane"]'),
    page.locator('[data-cy="study-browser-thumbnail"], [data-cy="study-browser-thumbnail-no-image"]'),
    page.getByRole('button', { name: 'Processing notifications' }),
    toasts(page),
  ];
  const suffix = () => xaStudies()[0].tag.split('_')[1] ?? xaStudies()[0].tag;

  test('viewer with a study', async ({ page }) => {
    await compareWithBaseline(page, `30-xa-${suffix()}-viewer`, viewerMasks(page));
  });

  test('results drawer', async ({ page }) => {
    await openAiMenu(page);
    test.skip(!(await page.locator(PREVIOUS_RESULT).count()), 'no stored AI result on the study (expired)');
    await page.locator(PREVIOUS_RESULT).first().getByRole('button', { name: /^View result/ }).click();
    await expect(page.locator(RESULT_DRAWER)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(8_000);
    await compareWithBaseline(page, `32-xa-${suffix()}-result`, [
      ...viewerMasks(page),
      // Run time and series scope of the latest run change when a model is rerun.
      page.locator(`${RESULT_DRAWER} header`),
    ]);
  });

  test('chat', async ({ page }) => {
    await page.getByTitle('Toggle Chat (Ctrl+/)').click();
    await expect(page.locator('.draggable-header').filter({ visible: true }).first()).toBeVisible();
    await page.waitForTimeout(2_000);
    await compareWithBaseline(page, '33-chat-open', viewerMasks(page));
  });
});
