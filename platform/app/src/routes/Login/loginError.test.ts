import { getLoginErrorMessage, requiresLoginChallenge } from './loginError';

const t = (key: string, values: Record<string, unknown> = {}) =>
  key.replace('{{seconds}}', String(values.seconds ?? ''));

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

    expect(message).toBe('Too many login attempts. Please wait 73 seconds before trying again.');
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
});
