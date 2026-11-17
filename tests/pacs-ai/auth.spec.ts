import { test, expect } from './support/fixtures';
import { env, storageStatePath } from './support/env';
import {
  FAKE_LOGIN_EMAIL,
  fillAndSubmitLogin,
  loginURL,
  recordFailedLogin,
  remainingFailedLoginBudget,
} from './support/auth';

/** F1/F2 — session, login and the guards around it. */

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login with the test account opens the work list', async ({ page }) => {
    await page.goto(loginURL());
    await expect(page.getByText('Welcome to PACS AI')).toBeVisible({ timeout: 30_000 });
    await fillAndSubmitLogin(page, env.user, env.password);
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 60_000 });
    expect(await page.evaluate(() => !!localStorage.getItem('sessionToken'))).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  });

  test('wrong password is refused and stays on the login page', async ({ page }) => {
    // Uses one of the three failed sign-ins this runner may make per window
    // (shared with login-cooldown.spec, same made-up account).
    test.skip(remainingFailedLoginBudget() < 1, 'failed sign-in budget of this runner used up; rerun in 11 minutes');
    await page.goto(loginURL());
    const login = page.waitForResponse(r => /\/iam\/login/.test(r.url()) && r.request().method() === 'POST');
    await fillAndSubmitLogin(page, FAKE_LOGIN_EMAIL, 'not-the-password-1');
    const response = await login;
    recordFailedLogin(FAKE_LOGIN_EMAIL);
    expect(response.status(), 'login refused').toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('sessionToken'))).toBeNull();
    await expect(
      page.getByTestId('login-attempt-limit-hint').or(page.getByTestId('login-cooldown-notice'))
    ).toBeVisible();
  });

  test('tenant lookup failure is shown without reloading the page', async ({ page }) => {
    let documentLoads = 0;
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) documentLoads++;
    });
    await page.goto('/login?t=pacs-ai-e2e-no-such-workspace');
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.evaluate(() => ((window as any).__pacsAiE2eMarker = true));
    const notFound = page.getByText('This workspace could not be found. Check the link and try again.');
    if (await notFound.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Try again' }).click();
      await expect(notFound).toBeVisible();
    } else {
      // A configured default tenant takes over with a client-side redirect.
      await expect(page).toHaveURL(/\/login\?t=/);
      await expect(page.locator('input[type=email]')).toBeVisible();
    }
    await page.waitForTimeout(3_000);
    expect(await page.evaluate(() => (window as any).__pacsAiE2eMarker === true), 'no full page reload').toBe(true);
    expect(documentLoads, 'document loads').toBeLessThanOrEqual(2);
  });
});

test.describe('signed in', () => {
  test.use({ storageState: storageStatePath });

  test('logout clears the session and returns to the login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Account menu' }).first().click();
    await page.getByRole('button', { name: 'Logout' }).or(page.getByRole('menuitem', { name: 'Logout' })).first().click();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('sessionToken'))).toBeNull();
  });

  test('an API 401 sends the user back to the login page', async ({ page }) => {
    await page.goto('/settings');
    await page.evaluate(() => localStorage.setItem('sessionToken', 'pacs-ai-e2e-invalid-token'));
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test('a policy-acceptance-required answer opens the policy acceptance gate', async ({ page }) => {
    let served = false;
    // Answer the first gated API call the way api-pacs does when a new policy
    // version is pending. The identity, tenant and policy endpoints stay
    // reachable (the acceptance page itself needs them).
    const exempt = /\/v1\/(user\/me|user\/policies|user\/metadata|tenant|iam)\b/;
    await page.route(/\/v1\//, async route => {
      if (served || route.request().resourceType() === 'document' || exempt.test(route.request().url())) {
        return route.continue();
      }
      served = true;
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, errorCode: 'POLICY_ACCEPTANCE_REQUIRED', message: 'policy' }),
      });
    });
    await page.goto('/ai-models');
    await expect(page).toHaveURL(/\/policies\/accept\?returnTo=/, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get('returnTo')).toMatch(/^\//);
  });
});
