import {
  formatLoginWait,
  getLoginErrorMessage,
  isLoginRateLimited,
  loginWaitMinutes,
  requiresLoginChallenge,
} from './loginError';

const t = (key: string, values: Record<string, unknown> = {}) =>
  key.replace(/{{(\w+)}}/g, (_, name: string) => String(values[name] ?? ''));

describe('login errors', () => {
  it('enters challenge mode from either the stable code or response data', () => {
    expect(requiresLoginChallenge({ errorCode: 'LOGIN_CHALLENGE_REQUIRED' })).toBe(true);
    expect(
      requiresLoginChallenge({
        errorCode: 'UNAUTHORIZED_ACCESS',
        challengeRequired: true,
      })
    ).toBe(true);
    expect(requiresLoginChallenge({ errorCode: 'UNAUTHORIZED_ACCESS' })).toBe(false);
  });

  it('keeps invalid credentials generic while still escalating the next attempt', () => {
    const failure = {
      errorCode: 'UNAUTHORIZED_ACCESS',
      status: 401,
      challengeRequired: true,
    };

    expect(getLoginErrorMessage(failure, t)).toBe('Invalid email or password');
    expect(requiresLoginChallenge(failure)).toBe(true);
  });

  it('uses Retry-After metadata without revealing whether the account exists', () => {
    const message = getLoginErrorMessage(
      {
        errorCode: 'LOGIN_RATE_LIMITED',
        status: 429,
        challengeRequired: true,
        retryAfterSeconds: 73,
      },
      t
    );

    expect(message).toBe('Too many login attempts. Please wait 1 min 13 s before trying again.');
    expect(message).not.toContain('account');
  });

  it('uses safe messages for provider and network failures', () => {
    expect(getLoginErrorMessage({ errorCode: 'CLOUDFLARE_API_ERROR', status: 503 }, t)).toBe(
      'Login verification is temporarily unavailable. Please try again.'
    );
    expect(getLoginErrorMessage({}, t)).toBe(
      'Unable to reach the login service. Check your connection and try again.'
    );
  });

  it('formats long waits in minutes and seconds', () => {
    expect(formatLoginWait(1, t)).toBe('1 s');
    expect(formatLoginWait(59, t)).toBe('59 s');
    expect(formatLoginWait(60, t)).toBe('1 min');
    expect(formatLoginWait(580, t)).toBe('9 min 40 s');
    expect(formatLoginWait(600, t)).toBe('10 min');
    expect(loginWaitMinutes(580)).toBe(10);
    expect(loginWaitMinutes(20)).toBe(1);
  });

  it('recognises rate limits by code or status', () => {
    expect(isLoginRateLimited({ errorCode: 'LOGIN_RATE_LIMITED' })).toBe(true);
    expect(isLoginRateLimited({ status: 429 })).toBe(true);
    expect(isLoginRateLimited({ errorCode: 'LOGIN_CHALLENGE_REQUIRED', status: 403 })).toBe(false);
  });
});
