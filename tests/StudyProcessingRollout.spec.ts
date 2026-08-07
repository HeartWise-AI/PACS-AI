import { request as playwrightRequest } from '@playwright/test';
import { expect, test } from 'playwright-test-coverage';

const deployment = {
  baseURL: process.env.PACS_AI_E2E_BASE_URL,
  ownerStorageState: process.env.PACS_AI_E2E_OWNER_STORAGE_STATE,
  ownerToken: process.env.PACS_AI_E2E_OWNER_TOKEN,
  visibleStudyUID: process.env.PACS_AI_E2E_VISIBLE_STUDY_UID,
  tenantAToken: process.env.PACS_AI_E2E_TENANT_A_TOKEN,
  tenantBToken: process.env.PACS_AI_E2E_TENANT_B_TOKEN,
  tenantAOnlyStudyUID: process.env.PACS_AI_E2E_TENANT_A_ONLY_STUDY_UID,
};

test.use({ trace: 'off', video: 'off' });

test.describe('deployed study-processing rollout', () => {
  test('loads bounded REST status and lazy history through the worklist UI', async ({
    browser,
  }) => {
    test.skip(
      !deployment.baseURL || !deployment.ownerStorageState || !deployment.visibleStudyUID,
      'Requires deployed base URL, owner storage state, and a visible study UID.'
    );

    const context = await browser.newContext({
      baseURL: deployment.baseURL,
      storageState: deployment.ownerStorageState,
    });
    const page = await context.newPage();
    const statusResponse = page.waitForResponse(response =>
      response.url().includes('/v1/inference/worklist/status')
    );
    const historyResponse = page.waitForResponse(response =>
      response
        .url()
        .includes(
          `/v1/inference/worklist/studies/${encodeURIComponent(deployment.visibleStudyUID!)}/runs`
        )
    );

    try {
      await page.goto(
        `/?processingStudyInstanceUID=${encodeURIComponent(deployment.visibleStudyUID!)}`
      );

      const status = await statusResponse;
      const statusURL = new URL(status.url());
      expect(status.status()).toBe(200);
      expect(statusURL.searchParams.has('tenantId')).toBe(false);
      expect(statusURL.searchParams.getAll('studyInstanceUID').length).toBeGreaterThan(0);
      expect(statusURL.searchParams.getAll('studyInstanceUID').length).toBeLessThanOrEqual(10);

      const history = await historyResponse;
      expect(history.status()).toBe(200);
      expect(new URL(history.url()).searchParams.has('tenantId')).toBe(false);
      await expect(
        page.getByRole('columnheader', { name: /Processing|Traitement/i }).first()
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('keeps an identical study UID isolated between two authenticated tenants', async () => {
    test.skip(
      !deployment.baseURL ||
        !deployment.tenantAToken ||
        !deployment.tenantBToken ||
        !deployment.tenantAOnlyStudyUID,
      'Requires two tenant tokens and a study UID visible only in tenant A.'
    );

    const path = `/v1/inference/worklist/status?${new URLSearchParams({
      studyInstanceUID: deployment.tenantAOnlyStudyUID!,
      limit: '1',
      offset: '0',
    })}`;
    const tenantA = await playwrightRequest.newContext({
      baseURL: deployment.baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${deployment.tenantAToken}` },
    });
    const tenantB = await playwrightRequest.newContext({
      baseURL: deployment.baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${deployment.tenantBToken}` },
    });

    try {
      const [tenantAResponse, tenantBResponse] = await Promise.all([
        tenantA.get(path),
        tenantB.get(path),
      ]);
      expect(tenantAResponse.status()).toBe(200);
      expect(tenantBResponse.status()).toBe(200);

      const tenantAStudies = (await tenantAResponse.json()).data.studies;
      const tenantBStudies = (await tenantBResponse.json()).data.studies;
      expect(tenantAStudies).toHaveLength(1);
      expect(tenantAStudies[0].studyInstanceUID).toBe(deployment.tenantAOnlyStudyUID);
      expect(tenantBStudies).toHaveLength(0);
      expect(path).not.toContain('tenantId');
    } finally {
      await tenantA.dispose();
      await tenantB.dispose();
    }
  });

  test('observes an unbuffered SSE connection comment and heartbeat through the proxy', async ({
    browser,
  }) => {
    test.skip(
      !deployment.baseURL || !deployment.ownerToken,
      'Requires deployed base URL and an owner/admin bearer token.'
    );

    const context = await browser.newContext({
      baseURL: deployment.baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${deployment.ownerToken}` },
    });
    const page = await context.newPage();

    try {
      await page.goto('/');
      const observation = await page.evaluate(async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 45_000);
        const startedAt = Date.now();

        try {
          const response = await fetch('/v1/inference/worklist/events', {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          });
          if (!response.ok || !response.body) {
            throw new Error('The SSE rollout endpoint was unavailable.');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let received = '';
          while (!received.includes(': heartbeat')) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            received += decoder.decode(value, { stream: true });
          }
          await reader.cancel();

          return {
            connected: received.includes(': connected'),
            heartbeat: received.includes(': heartbeat'),
            elapsedMs: Date.now() - startedAt,
            contentType: response.headers.get('content-type'),
            buffering: response.headers.get('x-accel-buffering'),
          };
        } finally {
          window.clearTimeout(timeout);
          controller.abort();
        }
      });

      expect(observation.contentType).toContain('text/event-stream');
      expect(observation.buffering).toBe('no');
      expect(observation.connected).toBe(true);
      expect(observation.heartbeat).toBe(true);
      expect(observation.elapsedMs).toBeGreaterThanOrEqual(10_000);
      expect(observation.elapsedMs).toBeLessThan(45_000);
    } finally {
      await context.close();
    }
  });
});
