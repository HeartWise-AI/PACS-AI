import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { xaStudies } from './support/env';
import { ensureStudyLocal } from './support/studies';
import { openViewer } from './support/viewer';

/**
 * F8 — the chat assistant in the viewer: opens from the header, streams its
 * answer, shows the tool-activity steps live and on the answer, and can be
 * dragged by its header. Uses the live assistant (allowed on the server).
 */

const QUESTION = 'Summarize the AI results available for this study in two sentences.';
const ANSWER_TIMEOUT_MS = 4 * 60_000;

async function openChat(page: Page) {
  await page.getByTitle('Toggle Chat (Ctrl+/)').click();
  const header = page.locator('.draggable-header').filter({ visible: true }).first();
  await expect(header).toBeVisible();
  const input = page.getByPlaceholder('Type your message...').filter({ visible: true }).last();
  await expect(input).toBeVisible();
  return { header, input };
}

test.beforeEach(async ({ page }) => {
  const study = xaStudies()[0];
  test.skip(!study, 'no XA reference study configured');
  const local = await ensureStudyLocal(page, study);
  test.skip(!local.ok, `reference study ${study.tag} is not available locally: ${local.reason}`);
  await openViewer(page, study.uid);
});

test('the chat opens, streams an answer and shows tool activity live and on the answer', async ({ page }) => {
  test.setTimeout(ANSWER_TIMEOUT_MS + 2 * 60_000);
  const { input } = await openChat(page);
  await input.fill(QUESTION);
  await input.press('Enter');

  // Live: the activity line with its elapsed time while the assistant works.
  await expect(page.locator('[data-cy="chat-activity-live"]').first()).toBeVisible({ timeout: 60_000 });

  // Streaming: the answer grows before it is complete.
  const answer = page.locator('[data-cy="chat-activity-summary"]').last();
  const lengths: number[] = [];
  const started = Date.now();
  while (Date.now() - started < ANSWER_TIMEOUT_MS) {
    const done = await answer.isVisible().catch(() => false);
    lengths.push((await page.locator('body').innerText()).length);
    if (done) break;
    await page.waitForTimeout(1_000);
  }
  await expect(answer, 'tool summary ("Used N tools") on the finished answer').toBeVisible();
  expect(new Set(lengths).size, 'the page changed while the answer was produced').toBeGreaterThan(2);
  await expect(page.locator('[data-cy="chat-activity-live"]')).toHaveCount(0);

  // On the answer: the summary expands into the steps.
  await answer.click();
  await expect(page.locator('[data-cy="chat-activity-steps"] li').first()).toBeVisible();
});

test('the chat window can be dragged by its header', async ({ page }) => {
  const { header } = await openChat(page);
  const before = await header.boundingBox();
  expect(before).not.toBeNull();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 - 200, before!.y + before!.height / 2 + 60, { steps: 10 });
  await page.mouse.up();
  const after = await header.boundingBox();
  expect(Math.round(after!.x - before!.x)).toBeLessThan(-150);
  expect(Math.round(after!.y - before!.y)).toBeGreaterThan(30);
});
