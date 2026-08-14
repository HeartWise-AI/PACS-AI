import type { AxiosError } from 'axios';
import type { ErrorAPIResponse } from './dto';
import { parseRetryAfterSeconds } from './httpRetryAfter';

interface LoginErrorResponse extends ErrorAPIResponse {
  readonly data?: {
    readonly challengeRequired?: boolean;
  };
}

export interface LoginAPIError extends ErrorAPIResponse {
  readonly status?: number;
  readonly challengeRequired: boolean;
  readonly retryAfterSeconds?: number;
}

export const createLoginAPIError = (
  error: AxiosError<LoginErrorResponse>
): LoginAPIError => {
  const response = error.response;
  const responseBody = response?.data;
  const retryAfterSeconds = parseRetryAfterSeconds(response?.headers?.['retry-after']);

  return {
    success: false,
    message: responseBody?.message || 'Login request failed.',
    challengeRequired: responseBody?.data?.challengeRequired === true,
    ...(responseBody?.errorCode ? { errorCode: responseBody.errorCode } : {}),
    ...(response?.status ? { status: response.status } : {}),
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
};
