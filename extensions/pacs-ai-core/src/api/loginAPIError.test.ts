import type { AxiosError } from 'axios';
import type { ErrorAPIResponse } from './dto';
import { createLoginAPIError } from './loginAPIError';

describe('loginAPIError', () => {
  it('preserves only stable challenge and retry metadata', () => {
    const sensitiveValue = ['test', 'credential'].join('-');
    const error = {
      config: {
        data: JSON.stringify({ email: 'visitor@example.org', password: sensitiveValue }),
      },
      request: { body: sensitiveValue },
      response: {
        status: 429,
        headers: { 'retry-after': '73' },
        data: {
          success: false,
          message: 'Too many login attempts.',
          errorCode: 'LOGIN_RATE_LIMITED',
          data: { challengeRequired: true },
        },
      },
    } as unknown as AxiosError<ErrorAPIResponse & { data: { challengeRequired: boolean } }>;

    const sanitized = createLoginAPIError(error);

    expect(sanitized).toEqual({
      success: false,
      message: 'Too many login attempts.',
      errorCode: 'LOGIN_RATE_LIMITED',
      status: 429,
      challengeRequired: true,
      retryAfterSeconds: 73,
    });
    expect(sanitized).not.toHaveProperty('config');
    expect(sanitized).not.toHaveProperty('request');
    expect(JSON.stringify(sanitized)).not.toContain(sensitiveValue);
  });

  it('returns a non-sensitive fallback for network failures', () => {
    expect(createLoginAPIError({} as AxiosError<ErrorAPIResponse>)).toEqual({
      success: false,
      message: 'Login request failed.',
      challengeRequired: false,
    });
  });
});
