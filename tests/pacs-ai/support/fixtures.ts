import { test as base, expect } from '@playwright/test';
import { missingRequiredEnv } from './env';

/**
 * Every PACS-AI spec imports `test` from here. The guard skips the spec when
 * it is not run through playwright.pacs-ai.config.ts (the repository's root
 * Playwright config also scans tests/) or when the environment is incomplete.
 */
export const test = base.extend<{ pacsAiGuard: void }>({
  pacsAiGuard: [
    async ({}, use, testInfo) => {
      if (process.env.PACS_AI_E2E_SUITE !== '1') {
        testInfo.skip(true, 'PACS-AI acceptance specs run only with tests/pacs-ai/playwright.pacs-ai.config.ts');
      }
      const missing = missingRequiredEnv();
      if (missing.length) {
        testInfo.skip(true, `missing environment: ${missing.join(', ')}`);
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** Collects uncaught page errors so a spec can assert the page stayed healthy. */
export function collectPageErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error).split('\n')[0].slice(0, 200)));
  return errors;
}
