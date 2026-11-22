import fs from 'node:fs';
import { chromium, type FullConfig } from '@playwright/test';
import { env, ensureDir, missingRequiredEnv, storageStatePath } from './support/env';
import { fillAndSubmitLogin, loginURL, recordFailedLogin, remainingFailedLoginBudget } from './support/auth';

/**
 * Signs in once and saves the storage state every spec reuses. The state file
 * holds a session token: it lives in PACS_AI_E2E_STATE_DIR (git-ignored,
 * mode 600) and is never printed. Credentials are never logged.
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const missing = missingRequiredEnv();
  if (missing.length) {
    // The specs skip themselves with the same message.
    console.warn(`[pacs-ai] not signing in, missing environment: ${missing.join(', ')}`);
    return;
  }
  ensureDir(env.stateDir);
  if (remainingFailedLoginBudget() <= 0) {
    throw new Error(
      '[pacs-ai] the failed sign-in budget of this runner is used up (rate limit window); wait 11 minutes'
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: env.baseURL, ignoreHTTPSErrors: true, locale: 'en-CA' });
  const page = await context.newPage();
  try {
    await page.goto(loginURL());
    await fillAndSubmitLogin(page, env.user, env.password);
    const signedIn = await page
      .waitForFunction(() => !!localStorage.getItem('sessionToken'), null, { timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
    if (!signedIn) {
      recordFailedLogin('other');
      throw new Error('[pacs-ai] sign-in of the test account failed (no session token after 60 s)');
    }
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000 });
    // English UI for every spec; i18n.spec switches to French in its own context.
    await page.evaluate(() => localStorage.setItem('i18nextLng', 'en-US'));
    await context.addCookies([{ name: 'i18next', value: 'en-US', url: env.baseURL }]);
    await context.storageState({ path: storageStatePath });
    fs.chmodSync(storageStatePath, 0o600);
    // Which frontend build is under test (the baseline names its own build).
    const build = await page
      .evaluate(async () => (await fetch('/version.json', { cache: 'no-store' })).json())
      .catch(() => null);
    console.log(`[pacs-ai] frontend build under test: ${build?.buildId ?? 'unknown'} (${build?.builtAt ?? '?'})`);
  } finally {
    await browser.close();
  }
}
