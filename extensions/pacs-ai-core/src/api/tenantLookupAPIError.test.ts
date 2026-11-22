import type { AxiosError } from 'axios';
import type { ErrorAPIResponse } from './dto';
import { createTenantLookupAPIError, isTenantNotFoundError } from './tenantLookupAPIError';

describe('tenantLookupAPIError', () => {
  it('preserves the status and error code of an API not-found response', () => {
    const error = {
      response: {
        status: 404,
        data: { success: false, message: 'No records found.', errorCode: 'MISSING_RECORD' },
      },
    } as AxiosError<ErrorAPIResponse>;

    const lookupError = createTenantLookupAPIError(error);

    expect(lookupError).toEqual({
      success: false,
      message: 'No records found.',
      errorCode: 'MISSING_RECORD',
      status: 404,
    });
    expect(isTenantNotFoundError(lookupError)).toBe(true);
  });

  it('keeps the status of a proxy error with a non-JSON body', () => {
    const error = {
      response: { status: 502, data: '<html>502 Bad Gateway</html>' },
    } as unknown as AxiosError<ErrorAPIResponse>;

    const lookupError = createTenantLookupAPIError(error);

    expect(lookupError).toEqual({
      success: false,
      message: 'Workspace lookup failed.',
      status: 502,
    });
    expect(isTenantNotFoundError(lookupError)).toBe(false);
  });

  it('does not treat network failures or server errors as not found', () => {
    expect(
      isTenantNotFoundError(createTenantLookupAPIError({} as AxiosError<ErrorAPIResponse>))
    ).toBe(false);
    expect(
      isTenantNotFoundError({ success: false, status: 500, errorCode: 'FIRESTORE_ERROR' })
    ).toBe(false);
    expect(isTenantNotFoundError(undefined)).toBe(false);
    expect(isTenantNotFoundError('Network Error')).toBe(false);
  });
});
