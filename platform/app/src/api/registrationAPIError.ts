import type { AxiosError } from 'axios';
import type { ErrorAPIResponse } from './dto';

export interface RegistrationAPIError extends ErrorAPIResponse {
  readonly status?: number;
  readonly retryAfterSeconds?: number;
}

export const parseRetryAfterSeconds = (
  value: unknown,
  nowMilliseconds = Date.now()
): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.ceil(value);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const deltaSeconds = Number(value);
  if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
    return Math.ceil(deltaSeconds);
  }

  const retryDate = Date.parse(value);
  if (Number.isNaN(retryDate) || retryDate <= nowMilliseconds) {
    return undefined;
  }
  return Math.ceil((retryDate - nowMilliseconds) / 1000);
};

export const createRegistrationAPIError = (
  error: AxiosError<ErrorAPIResponse>
): RegistrationAPIError => {
  const response = error.response;
  const responseBody = response?.data;
  const retryAfterSeconds = parseRetryAfterSeconds(response?.headers?.['retry-after']);

  return {
    success: false,
    message: responseBody?.message || 'Registration request failed.',
    ...(responseBody?.errorCode ? { errorCode: responseBody.errorCode } : {}),
    ...(response?.status ? { status: response.status } : {}),
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
};
