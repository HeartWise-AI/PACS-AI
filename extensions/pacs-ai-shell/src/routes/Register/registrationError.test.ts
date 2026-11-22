import { getRegistrationErrorMessage } from './registrationError';

const t = (key: string, values: Record<string, unknown> = {}) =>
  key.replace('{{seconds}}', String(values.seconds ?? ''));

describe('getRegistrationErrorMessage', () => {
  it('uses Retry-After metadata for throttled registration', () => {
    expect(
      getRegistrationErrorMessage(
        {
          errorCode: 'REGISTRATION_RATE_LIMITED',
          status: 429,
          retryAfterSeconds: 73,
        },
        t
      )
    ).toBe('Too many registration attempts. Please wait 73 seconds before trying again.');
  });

  it('asks for a fresh challenge when Turnstile rejects the proof', () => {
    expect(getRegistrationErrorMessage({ errorCode: 'TURNSTILE_INVALID', status: 400 }, t)).toBe(
      'Complete the verification again before registering.'
    );
  });

  it('does not confirm whether an account already exists', () => {
    const message = getRegistrationErrorMessage({ errorCode: 'DUPLICATE_RECORD', status: 409 }, t);

    expect(message).toContain('Registration could not be completed.');
    expect(message).not.toContain('already exists');
  });

  it('requires another review when the backend reports a policy version change', () => {
    expect(getRegistrationErrorMessage({ errorCode: 'POLICY_VERSION_STALE', status: 409 }, t)).toBe(
      'The policies were updated. Review the current versions and check the box again.'
    );
  });

  it('keeps safe backend field validation details', () => {
    expect(
      getRegistrationErrorMessage(
        {
          errorCode: 'INVALID_PAYLOAD',
          status: 400,
          message: 'A valid email address is required.',
        },
        t
      )
    ).toBe('A valid email address is required.');
  });

  it('uses non-sensitive fallbacks for network and server failures', () => {
    expect(getRegistrationErrorMessage({}, t)).toContain('Check your connection');
    expect(getRegistrationErrorMessage({ status: 500 }, t)).toBe(
      'Registration is temporarily unavailable. Please try again later.'
    );
  });
});
