import type { AxiosError } from 'axios';
import type { ErrorAPIResponse } from './dto';

// Backend error code for a record that does not exist (api-pacs internal/errors MissingRecord).
export const TENANT_NOT_FOUND_ERROR_CODE = 'MISSING_RECORD';

export interface TenantLookupAPIError extends ErrorAPIResponse {
  // HTTP status of the failed lookup; absent for network failures and timeouts.
  readonly status?: number;
}

export const createTenantLookupAPIError = (
  error: AxiosError<ErrorAPIResponse>
): TenantLookupAPIError => {
  const response = error?.response;
  // Proxies (for example nginx 502 pages) can answer with non-JSON bodies.
  const responseBody =
    response?.data && typeof response.data === 'object' ? response.data : undefined;

  return {
    success: false,
    message: responseBody?.message || 'Workspace lookup failed.',
    ...(responseBody?.errorCode ? { errorCode: responseBody.errorCode } : {}),
    ...(response?.status ? { status: response.status } : {}),
  };
};

/**
 * True only when the API definitively reports that the tenant does not exist.
 * Server errors, proxy errors and network failures are never treated as "not found".
 */
export const isTenantNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { status, errorCode } = error as Partial<TenantLookupAPIError>;
  return status === 404 || errorCode === TENANT_NOT_FOUND_ERROR_CODE;
};
