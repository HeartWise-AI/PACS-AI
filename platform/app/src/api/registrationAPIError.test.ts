import type { AxiosError } from 'axios';
import type { ErrorAPIResponse } from './dto';
import { parseRetryAfterSeconds } from './httpRetryAfter';
import { createRegistrationAPIError } from './registrationAPIError';

describe('registrationAPIError', () => {
  it('parses delta-seconds and HTTP-date Retry-After values', () => {
    expect(parseRetryAfterSeconds('73')).toBe(73);
    expect(parseRetryAfterSeconds('Thu, 01 Jan 2026 00:01:30 GMT', Date.UTC(2026, 0, 1))).toBe(90);
    expect(parseRetryAfterSeconds('invalid')).toBeUndefined();
  });

  it('preserves stable registration error metadata', () => {
    const error = {
      response: {
        status: 429,
        headers: { 'retry-after': '73' },
        data: {
          success: false,
          message: 'Too many registration attempts.',
          errorCode: 'REGISTRATION_RATE_LIMITED',
        },
      },
    } as AxiosError<ErrorAPIResponse>;

    expect(createRegistrationAPIError(error)).toEqual({
      success: false,
      message: 'Too many registration attempts.',
      errorCode: 'REGISTRATION_RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 73,
    });
  });

  it('returns a non-sensitive fallback for network failures', () => {
    expect(createRegistrationAPIError({} as AxiosError<ErrorAPIResponse>)).toEqual({
      success: false,
      message: 'Registration request failed.',
    });
  });
});
