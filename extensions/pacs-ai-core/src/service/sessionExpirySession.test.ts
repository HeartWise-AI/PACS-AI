import {
  SESSION_EXPIRED_REDIRECT_PENDING_KEY,
  SESSION_EXPIRED_RETURN_TO_KEY,
  consumeSessionExpiredRedirect,
  getPendingSessionExpiredLoginURL,
  getSessionExpiredReturnPath,
  handleSessionExpiredError,
  isPublicAuthRequest,
} from './sessionExpirySession';

const createStorage = (values: Record<string, string>) => ({
  getItem: jest.fn((key: string) => values[key] ?? null),
  removeItem: jest.fn((key: string) => {
    delete values[key];
  }),
  setItem: jest.fn((key: string, value: string) => {
    values[key] = value;
  }),
});

const expiredError = (url = '/v1/orchestrator/threads/thread-1/chat') => ({
  config: { url },
  response: { status: 401, data: { errorCode: 'UNAUTHORIZED_ACCESS' } },
});

describe('expired session handling', () => {
  test('clears the session and redirects to tenant login with a safe return path', () => {
    const values = { tenantId: 'tenant / east', sessionToken: 'expired-token' };
    const storage = createStorage(values);
    const redirect = jest.fn();

    expect(
      handleSessionExpiredError(expiredError(), {
        storage,
        redirect,
        location: {
          pathname: '/viewer',
          search: '?StudyInstanceUIDs=1.2.3',
          hash: '#measurements',
        },
      })
    ).toBe(true);

    expect(values).not.toHaveProperty('sessionToken');
    expect(values).toHaveProperty(SESSION_EXPIRED_REDIRECT_PENDING_KEY, 'true');
    expect(values).toHaveProperty(
      SESSION_EXPIRED_RETURN_TO_KEY,
      '/viewer?StudyInstanceUIDs=1.2.3#measurements'
    );
    expect(redirect).toHaveBeenCalledWith(
      '/login?t=tenant+%2F+east&reason=session_expired&returnTo=%2Fviewer%3FStudyInstanceUIDs%3D1.2.3%23measurements'
    );
  });

  test('deduplicates concurrent unauthorized responses', () => {
    const values = {
      tenantId: 'tenant-a',
      sessionToken: 'expired-token',
      [SESSION_EXPIRED_REDIRECT_PENDING_KEY]: 'true',
    };
    const storage = createStorage(values);
    const redirect = jest.fn();

    expect(handleSessionExpiredError(expiredError(), { storage, redirect })).toBe(true);
    expect(storage.removeItem).not.toHaveBeenCalledWith('sessionToken');
    expect(redirect).not.toHaveBeenCalled();
  });

  test('ignores unauthorized responses without an authenticated session', () => {
    const storage = createStorage({ tenantId: 'tenant-a' });
    const redirect = jest.fn();

    expect(handleSessionExpiredError(expiredError(), { storage, redirect })).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  test.each([
    '/v1/iam/login',
    '/v1/iam/forgot-password',
    'https://demo.pacsai.co/v1/tenant/public?tenantId=tenant-a',
  ])('does not treat public endpoint %s as an expired session', url => {
    const storage = createStorage({ sessionToken: 'existing-token' });
    const redirect = jest.fn();

    expect(handleSessionExpiredError(expiredError(url), { storage, redirect })).toBe(false);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(isPublicAuthRequest(url)).toBe(true);
  });

  test('requires both HTTP 401 and the unauthorized error code', () => {
    const storage = createStorage({ sessionToken: 'keep-me' });
    const redirect = jest.fn();

    expect(
      handleSessionExpiredError(
        {
          config: { url: '/v1/orchestrator/threads' },
          response: { status: 403, data: { errorCode: 'UNAUTHORIZED_ACCESS' } },
        },
        { storage, redirect }
      )
    ).toBe(false);
    expect(
      handleSessionExpiredError(
        {
          config: { url: '/v1/orchestrator/threads' },
          response: { status: 401, data: { errorCode: 'ACCOUNT_SUSPENDED' } },
        },
        { storage, redirect }
      )
    ).toBe(false);
  });

  test('preserves the pending expired-session redirect for downstream logout handlers', () => {
    const storage = createStorage({
      tenantId: 'tenant-a',
      [SESSION_EXPIRED_REDIRECT_PENDING_KEY]: 'true',
      [SESSION_EXPIRED_RETURN_TO_KEY]: '/viewer?study=1',
    });

    expect(getPendingSessionExpiredLoginURL(storage)).toBe(
      '/login?t=tenant-a&reason=session_expired&returnTo=%2Fviewer%3Fstudy%3D1'
    );
  });

  test('consumes the reason once and validates the post-login destination', () => {
    const storage = createStorage({
      [SESSION_EXPIRED_REDIRECT_PENDING_KEY]: 'true',
      [SESSION_EXPIRED_RETURN_TO_KEY]: '/viewer?study=1',
    });

    expect(
      consumeSessionExpiredRedirect(
        '?t=tenant-a&reason=session_expired&returnTo=%2Fviewer%3Fstudy%3D1',
        storage
      )
    ).toEqual({
      expired: true,
      nextSearch: '?t=tenant-a&returnTo=%2Fviewer%3Fstudy%3D1',
      returnTo: '/viewer?study=1',
    });
    expect(getSessionExpiredReturnPath('?returnTo=https%3A%2F%2Fevil.example')).toBe('/');
    expect(getSessionExpiredReturnPath('?returnTo=%2F%2Fevil.example')).toBe('/');
  });
});
