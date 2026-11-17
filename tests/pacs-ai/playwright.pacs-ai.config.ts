import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { env, storageStatePath } from './support/env';

/**
 * PACS-AI acceptance suite (OHIF upgrade plan, section 8): proves the PACS-AI
 * features survive the OHIF upgrade, against a deployed build and its real
 * backend. Configuration comes only from the environment, see support/env.ts.
 *
 *   cd tests/pacs-ai && npm ci
 *   npx playwright test -c playwright.pacs-ai.config.ts [spec]
 *
 * Rules for the live server: read-only, except model runs from the viewer on
 * the reference studies and retrieving those studies from the PACS when the
 * local copy has expired. No "Reprocess study", no member, settings or
 * catalog changes, no uploads. No screenshots, traces or videos are recorded
 * (patient data); visual.spec compares against a host folder only.
 */
process.env.PACS_AI_E2E_SUITE = '1';

export default defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.ts',
  outputDir: env.outputDir,
  globalSetup: require.resolve('./global-setup'),
  // One live server, one GPU queue and a shared login rate limit: run serially.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 5 * 60_000,
  expect: { timeout: 20_000 },
  // visual.spec compares in memory against the host baseline; never write snapshots.
  updateSnapshots: 'none',
  reporter: [['list'], ['json', { outputFile: path.join(env.outputDir, 'report.json') }]],
  use: {
    baseURL: env.baseURL || undefined,
    ignoreHTTPSErrors: true,
    storageState: storageStatePath,
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'pacs-ai',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
});
