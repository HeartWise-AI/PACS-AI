import { test, expect, collectPageErrors } from './support/fixtures';
import { WORKLIST_ROW, searchReferenceDateRange } from './support/worklist';

/**
 * Opening a study from the work list while the PACS retrieve is still running:
 * the viewer opens as soon as the first series is stored and follows the rest.
 * The retrieve and its job status are answered by the test, so no image is
 * moved from the hospital PACS.
 */

const FIRST = 'test-job-first-series';
const REST = 'test-job-other-series';

test('the viewer opens once the first series is in, without waiting for the rest', async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  let retrieveCalls = 0;
  let jobPolls = 0;

  await page.route(/\/v1\/orthanc\/modality\/retrieve/, async route => {
    retrieveCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 200,
        success: true,
        message: 'test',
        data: [
          { id: REST, path: `/jobs/${REST}`, order: 1, seriesNumber: '2' },
          { id: FIRST, path: `/jobs/${FIRST}`, order: 0, seriesNumber: '1' },
        ],
      }),
    });
  });
  await page.route(/\/v1\/orthanc\/jobs/, async route => {
    jobPolls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 200,
        success: true,
        message: 'test',
        data: [
          { id: FIRST, progress: 100, state: 'Success', priority: 1002 },
          // The other series never finishes during the test.
          { id: REST, progress: 0, state: 'Pending', priority: 1001 },
        ],
      }),
    });
  });

  await searchReferenceDateRange(page);
  await page.locator(WORKLIST_ROW).first().click();
  const expanded = page.locator('tr.expandable-content').first();
  const startedAt = Date.now();
  await expanded.getByRole('button', { name: 'Basic Viewer' }).click();

  await page.waitForURL(/\/viewer\?StudyInstanceUIDs=/, { timeout: 15_000 });
  const openedAfterMs = Date.now() - startedAt;
  expect(retrieveCalls, 'one retrieve request').toBe(1);
  // One poll at 1 s, no 2 s pause before opening.
  expect(openedAfterMs, 'opened without waiting for the second series').toBeLessThan(5_000);

  // The viewer keeps following the series that is still coming.
  const pollsAtOpen = jobPolls;
  await expect.poll(() => jobPolls, { timeout: 10_000 }).toBeGreaterThan(pollsAtOpen);
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible({
    timeout: 60_000,
  });
  expect(errors, 'uncaught page errors').toEqual([]);
});
