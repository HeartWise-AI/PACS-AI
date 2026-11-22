import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { xaStudies } from './support/env';
import { ensureStudyLocal } from './support/studies';
import { openViewer, viewerState } from './support/viewer';

/**
 * F15 — viewer behaviour PACS-AI changed in OHIF: cine autoplay for XA/US,
 * arrow keys change the series and page keys the image, and the current
 * series is shown in the viewport action bar. State is read from the OHIF
 * services the cornerstone extension exposes on window.
 */

async function focusViewport(page: Page): Promise<void> {
  const viewport = page.locator('.cornerstone-viewport-element').first();
  // Hotkeys are bound on the document; a plain click makes sure no input has focus.
  await viewport.click({ position: { x: 40, y: 80 } });
}

async function stopCine(page: Page): Promise<void> {
  await page.evaluate(() => {
    const services = (window as any).services;
    const id = services.viewportGridService.getActiveViewportId();
    services.cineService.setCine({ id, isPlaying: false });
  });
}

const actionBarSeries = (page: Page) =>
  page.locator('span', { hasText: /^Series:\s*$/ }).first().locator('xpath=following-sibling::span[1]');

test.beforeEach(async ({ page }) => {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  await openViewer(page, study.uid);
  await expect.poll(async () => (await viewerState(page))?.imageIndex ?? null, { timeout: 60_000 }).not.toBeNull();
});

test('an XA series autoplays its cine', async ({ page }) => {
  await expect.poll(async () => (await viewerState(page))?.modality, { timeout: 30_000 }).toBe('XA');
  await expect.poll(async () => (await viewerState(page))?.cinePlaying, { timeout: 30_000 }).toBe(true);
  const first = (await viewerState(page))!.imageIndex;
  await expect
    .poll(async () => (await viewerState(page))?.imageIndex, { timeout: 15_000, message: 'frames advance without input' })
    .not.toBe(first);
});

test('arrow keys change the series', async ({ page }) => {
  const before = await viewerState(page);
  await focusViewport(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await viewerState(page))?.displaySetUID, { timeout: 30_000 }).not.toBe(before!.displaySetUID);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await viewerState(page))?.displaySetUID, { timeout: 30_000 }).toBe(before!.displaySetUID);
});

test('the viewport action bar shows the current series and follows the arrow keys', async ({ page }) => {
  // PACS-AI added "Series: <current>" to ui-next ViewportActionBar (F15).
  const label = actionBarSeries(page);
  await expect(label, '"Series:" label in the viewport action bar').toBeVisible();
  const labelBefore = (await label.innerText()).trim();
  expect(labelBefore).not.toBe('');
  await focusViewport(page);
  await page.keyboard.press('ArrowDown');
  await expect(label).not.toHaveText(labelBefore);
});

test('page keys change the image within the series', async ({ page }) => {
  await stopCine(page);
  await focusViewport(page);
  const series = (await viewerState(page))!.displaySetUID;
  const start = (await viewerState(page))!.imageIndex!;
  await page.keyboard.press(start > 0 ? 'PageUp' : 'PageDown');
  const expected = start > 0 ? start - 1 : start + 1;
  await expect.poll(async () => (await viewerState(page))?.imageIndex, { timeout: 15_000 }).toBe(expected);
  expect((await viewerState(page))!.displaySetUID, 'still the same series').toBe(series);
});
