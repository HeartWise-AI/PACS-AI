import {
  ACCOUNT_SUSPENDED_ERROR_CODE,
  ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY,
  consumeAccountSuspendedRedirect,
  getPendingAccountSuspendedLoginURL,
  handleAccountSuspendedError,
} from './accountAccessSession';

const createStorage = (values: Record<string, string>) => ({
  getItem: jest.fn((key: string) => values[key] ?? null),
  removeItem: jest.fn((key: string) => {
    delete values[key];
  }),
  setItem: jest.fn((key: string, value: string) => {
    values[key] = value;
  }),
});

describe('suspended account session handling', () => {
  test('removes the session and safely replaces the page with the tenant login', () => {
    const storageValues = { tenantId: 'tenant / east', sessionToken: 'secret' };
    const storage = createStorage(storageValues);
    const redirect = jest.fn();

    expect(
      handleAccountSuspendedError(
        { response: { data: { errorCode: ACCOUNT_SUSPENDED_ERROR_CODE } } },
        { storage, redirect }
      )
    ).toBe(true);

    expect(storage.removeItem).toHaveBeenCalledWith('sessionToken');
    expect(storageValues).not.toHaveProperty('sessionToken');
    expect(storageValues).toHaveProperty(ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY, 'true');
    expect(redirect).toHaveBeenCalledWith('/login?t=tenant+%2F+east&reason=account_suspended');
  });

  test('keeps later logout handlers on the suspension-aware login URL', () => {
    const storage = createStorage({
      tenantId: 'tenant-a',
      [ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY]: 'true',
    });

    expect(getPendingAccountSuspendedLoginURL(storage)).toBe(
      '/login?t=tenant-a&reason=account_suspended'
    );
  });

  test('uses a tenant-independent login URL when tenant context is unavailable', () => {
    const storage = createStorage({ sessionToken: 'secret' });
    const redirect = jest.fn();

    handleAccountSuspendedError(
      { response: { data: { errorCode: ACCOUNT_SUSPENDED_ERROR_CODE } } },
      { storage, redirect }
    );

    expect(redirect).toHaveBeenCalledWith('/login?reason=account_suspended');
  });

  test('leaves unrelated API failures untouched', () => {
    const storage = createStorage({ sessionToken: 'keep-me' });
    const redirect = jest.fn();

    expect(
      handleAccountSuspendedError(
        { response: { data: { errorCode: 'UNAUTHORIZED_ACCESS' } } },
        { storage, redirect }
      )
    ).toBe(false);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  test('consumes the suspension marker once while preserving tenant context', () => {
    const storage = createStorage({ [ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY]: 'true' });

    expect(
      consumeAccountSuspendedRedirect('?t=tenant-a&reason=account_suspended', storage)
    ).toEqual({
      suspended: true,
      nextSearch: '?t=tenant-a',
    });
    expect(storage.removeItem).toHaveBeenCalledWith(ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY);
    expect(consumeAccountSuspendedRedirect('?t=tenant-a')).toEqual({
      suspended: false,
      nextSearch: '?t=tenant-a',
    });
  });
});
