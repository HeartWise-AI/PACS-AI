import { test, expect } from './support/fixtures';
import {
  FAKE_LOGIN_EMAIL,
  IP_FAILED_LOGIN_BUDGET,
  failedLoginsInWindow,
  fillAndSubmitLogin,
  loginURL,
  msUntilLedgerFrees,
  recordFailedLogin,
  remainingFailedLoginBudget,
} from './support/auth';

/**
 * F24 — login cooldown notice (#501). After three wrong passwords on one
 * account the server pauses sign-in for it; when the Turnstile challenge
 * cannot be used the login page shows a cooldown notice with a countdown and
 * a reset-password link, and Login is enabled again when the wait ends.
 *
 * Safety: only a made-up e-mail on a non-existent account is used, and the
 * suite never makes more than three failed sign-ins per window from this
 * runner (a fourth from the same IP risks a 10-minute IP lockout). Failed
 * attempts already made by auth.spec on the same made-up account count
 * towards the three.
 */

const MAX_WAIT_S = 11 * 60;

test.use({ storageState: { cookies: [], origins: [] } });

test('three wrong passwords on a made-up account show the cooldown notice, then Login re-enables', async ({ page }) => {
  const already = failedLoginsInWindow('fake');
  const needed = IP_FAILED_LOGIN_BUDGET - already;
  test.skip(
    needed <= 0,
    `the made-up account is already in its cooldown window; rerun in ${Math.ceil(msUntilLedgerFrees() / 60_000)} min`
  );
  test.skip(
    remainingFailedLoginBudget() < needed,
    `not enough failed sign-in budget left on this runner (need ${needed}); rerun in ${Math.ceil(msUntilLedgerFrees() / 60_000)} min`
  );
  test.setTimeout((MAX_WAIT_S + 4 * 60) * 1000);

  await page.goto(loginURL());
  let retryAfter = 0;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= needed; attempt++) {
    const response = page.waitForResponse(r => /\/iam\/login/.test(r.url()) && r.request().method() === 'POST');
    await fillAndSubmitLogin(page, FAKE_LOGIN_EMAIL, `not-the-password-${already + attempt}`);
    const res = await response;
    recordFailedLogin(FAKE_LOGIN_EMAIL);
    lastStatus = res.status();
    retryAfter = Number(res.headers()['retry-after'] ?? 0) || retryAfter;
    expect(lastStatus, `attempt ${already + attempt} refused`).toBeGreaterThanOrEqual(400);
    await expect(page.getByRole('button', { name: /^(Login|Signing in…)$/ })).toBeVisible();
    // Wait for the form to settle before the next attempt.
    await expect(page.getByRole('button', { name: 'Signing in…' })).toHaveCount(0, { timeout: 30_000 });
  }

  const notice = page.getByTestId('login-cooldown-notice');
  await expect(notice, 'cooldown notice after three failures').toBeVisible({ timeout: 30_000 });
  await expect(notice).toContainText('Too many failed sign-in attempts.');
  await expect(notice.getByRole('button', { name: 'Forgot your password? Reset it instead of waiting.' })).toBeVisible();

  const login = page.getByRole('button', { name: 'Login', exact: true });
  if (retryAfter > 0) {
    const countdown = page.getByText(/^Login is temporarily limited\. Try again in .+\.$/);
    await expect(countdown, 'countdown while the wait lasts').toBeVisible();
    await expect(login).toBeDisabled();
    test.skip(retryAfter > MAX_WAIT_S, `the server asks for ${retryAfter} s, longer than this test waits`);
    await expect(login, 'Login enabled again when the wait ends').toBeEnabled({ timeout: (retryAfter + 30) * 1000 });
    await expect(countdown).toBeHidden();
  } else {
    test.info().annotations.push({
      type: 'note',
      description: `the server sent no Retry-After (HTTP ${lastStatus}); the notice shows the generic wait`,
    });
    await expect(notice).toContainText(/sign-in is paused/);
  }
});
