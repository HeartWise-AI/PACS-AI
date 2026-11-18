import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';

/**
 * The tutorial's "Run Inference to Model" step outside the viewer: it takes
 * the user to the study list with a modality and the last 7 days selected,
 * runs the search, walks them into the first study, and continues on the AI
 * model button in the viewer.
 *
 * The study it opens is already stored on the server, so the test retrieves
 * nothing from the hospital PACS.
 *
 * The test user's tutorial is finished, so the browser is told the tutorial
 * stopped just before this step; progress writes are answered in the browser
 * and never reach the account.
 */

const STEP_ROW = '[data-tour-id="worklist-study-row"]';
const OPEN_VIEWER = '[data-tour-id="worklist-open-viewer"]';
const TOUR_STEP = '.shepherd-element:not([hidden])';

async function fakeTutorialBeforeRunInference(page: Page): Promise<{ progressWrites: () => number }> {
  let resolveSurvey: (hasPreSurvey: boolean) => void = () => {};
  const hasPreSurvey = new Promise<boolean>(resolve => (resolveSurvey = resolve));
  let writes = 0;

  await page.route(/\/v1\/tenant(\?|$)/, async route => {
    const response = await route.fetch();
    try {
      const body = await response.json();
      const tenant = body?.data ?? body;
      resolveSurvey((tenant?.onboardingQuestionnaires?.PRE_SURVEY ?? []).length > 0);
    } catch {
      resolveSurvey(false);
    }
    await route.fulfill({ response });
  });
  await page.route(/\/v1\/user\/metadata(\?|$)/, async route => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }
    const withPre = await Promise.race([
      hasPreSurvey,
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 15_000)),
    ]);
    // 1-based count of completed steps: everything before run-inference.
    await route.fulfill({ json: { tutorialProgressStep: withPre ? 2 : 1 } });
  });
  await page.route(/\/v1\/user\/metadata\/update/, async route => {
    writes += 1;
    await route.fulfill({ json: { success: true } });
  });
  return { progressWrites: () => writes };
}

test('run-inference opens the study list, searches a modality over the last 7 days and walks into a study', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const progress = await fakeTutorialBeforeRunInference(page);

  await page.goto('/ai-models');
  await page.evaluate(() => sessionStorage.removeItem('pacsai.tutorial.pendingStep'));
  const toggle = page.getByText(/^Tutorials \d+%$/);
  await toggle.click({ timeout: 60_000 });
  const step = page.getByRole('button', { name: /Run Inference to Model/ });
  await expect(step).toBeEnabled({ timeout: 30_000 });

  const search = page.waitForRequest(
    request => request.url().includes('/v1/orthanc/modality/studies') && request.method() === 'POST',
    { timeout: 60_000 }
  );
  await step.click();

  // On the study list, with a modality and the last 7 days chosen.
  await expect(page).toHaveURL(/tutorialSearch=1/);
  const body = (await search).postDataJSON();
  expect(['XA', 'US']).toContain(body.modalitiesInStudy);
  // The last 7 days: without dates the PACS answers with its oldest studies.
  expect(body.studyDate).toMatch(/^\d{8}-\d{8}$/);
  const [from, to] = String(body.studyDate).split('-');
  const days = (Date.UTC(+to.slice(0, 4), +to.slice(4, 6) - 1, +to.slice(6)) -
    Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6))) / 86_400_000;
  expect(days).toBe(6);
  await expect(page.locator('#FilterStartDate')).not.toHaveValue('');
  await expect(page.locator('#FilterEndDate')).not.toHaveValue('');
  await expect(page.locator(TOUR_STEP)).toContainText('Searching', { timeout: 15_000 });

  // The tour points at the most recent study already stored on the server
  // (opening it retrieves nothing from the hospital PACS); only it can be clicked.
  await expect(page.locator(TOUR_STEP)).toContainText(/Click this study|is ready to open/, {
    timeout: 150_000,
  });
  test.skip(
    /is ready to open/.test((await page.locator(TOUR_STEP).textContent()) ?? ''),
    'no study of this modality is stored on the server right now'
  );
  await expect(page.locator(TOUR_STEP).getByRole('button', { name: /Skip/i })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator(TOUR_STEP)).toContainText('Click this study');
  await page.locator(STEP_ROW).click();

  await expect(page.locator(TOUR_STEP)).toContainText('Basic Viewer', { timeout: 15_000 });
  await page.locator(`${OPEN_VIEWER} button`).first().click();

  // In the viewer the step's own tour starts on the AI model button.
  await expect(page).toHaveURL(/\/viewer\?StudyInstanceUIDs=/, { timeout: 120_000 });
  await expect(page.locator(TOUR_STEP)).toContainText('Open the AI Models menu', { timeout: 120_000 });
  expect(await page.evaluate(() => sessionStorage.getItem('pacsai.tutorial.pendingStep'))).toBeNull();
  expect(progress.progressWrites(), 'no progress saved before the AI model button').toBe(0);
});
