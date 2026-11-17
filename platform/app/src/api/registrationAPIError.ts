import type { AxiosError } from 'axios';
import type { ErrorAPIResponse } from './dto';
import { parseRetryAfterSeconds } from './httpRetryAfter';

export interface RegistrationAPIError extends ErrorAPIResponse {
  readonly status?: number;
  readonly retryAfterSeconds?: number;
}

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
