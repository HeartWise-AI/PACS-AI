import { defineConfig, devices } from '@playwright/test';

/**
 * Opt-in deployed study-processing rollout check
 * (pacs-ai/docs/pacs-ai-realtime-worklist-rollout.md). Runs against a deployed
 * viewer only; every value comes from the environment (PACS_AI_E2E_*), and the
 * spec skips each test whose inputs are missing. No web server is started.
 *
 *   PACS_AI_E2E_BASE_URL=... npx playwright test -c tests/pacs-ai/rollout/playwright.rollout.config.ts
 *
 * Run from the repository root (the spec uses the root's playwright-test-coverage).
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  outputDir: '../../test-results/pacs-ai-rollout',
  reporter: [['list']],
  timeout: 800_000,
  use: {
    baseURL: process.env.PACS_AI_E2E_BASE_URL,
    trace: 'off',
    video: 'off',
    testIdAttribute: 'data-cy',
    actionTimeout: 10_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
});
