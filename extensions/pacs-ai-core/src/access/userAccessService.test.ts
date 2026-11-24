import userRepository from '../api/userRepository';
import { clearAuthenticatedSession } from '../utils/authenticatedSession';
import {
  FALLBACK_RETRY_MS,
  clearUserAccess,
  getCachedUserAccess,
  loadUserAccess,
  subscribeUserAccess,
} from './userAccessService';

jest.mock('../api/userRepository', () => ({
  __esModule: true,
  default: {
    GetMyAccess: jest.fn(),
    GetCurrentUser: jest.fn(),
  },
}));

const repo = userRepository as unknown as {
  GetMyAccess: jest.Mock;
  GetCurrentUser: jest.Mock;
};

describe('userAccessService', () => {
  beforeEach(() => {
    clearUserAccess();
    repo.GetMyAccess.mockReset();
    repo.GetCurrentUser.mockReset();
  });

  it('loads once and serves the cache afterwards', async () => {
    repo.GetMyAccess.mockResolvedValue({
      data: {
        role: 'USER',
        permissions: ['feedback.view'],
        allModels: true,
        modelIds: [],
        customRole: null,
      },
    });
    const first = await loadUserAccess();
    const second = await loadUserAccess();
    expect(first).toBe(second);
    expect(repo.GetMyAccess).toHaveBeenCalledTimes(1);
    expect(first?.permissions.has('feedback.view')).toBe(true);
    expect(getCachedUserAccess()).toBe(first);
  });

  it('shares one in-flight request', async () => {
    repo.GetMyAccess.mockResolvedValue({ data: { role: 'ADMIN' } });
    const [a, b] = await Promise.all([loadUserAccess(), loadUserAccess()]);
    expect(a).toBe(b);
    expect(repo.GetMyAccess).toHaveBeenCalledTimes(1);
  });

  it('falls back to the base role when the access endpoint is missing', async () => {
    repo.GetMyAccess.mockRejectedValue({ errorCode: 'NOT_FOUND' });
    repo.GetCurrentUser.mockResolvedValue({ data: { role: 'ADMIN' } });
    const access = await loadUserAccess();
    expect(access?.isAdmin).toBe(true);
  });

  it('retries the access endpoint after a role-only fallback expires', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    repo.GetMyAccess.mockRejectedValueOnce({ errorCode: 'INTERNAL' });
    repo.GetCurrentUser.mockResolvedValue({ data: { role: 'USER' } });
    const fallback = await loadUserAccess();
    expect(fallback?.permissions.has('feedback.view')).toBe(false);

    repo.GetMyAccess.mockResolvedValue({
      data: { role: 'USER', permissions: ['feedback.view'], allModels: true, modelIds: [] },
    });
    expect(await loadUserAccess()).toBe(fallback);
    expect(repo.GetMyAccess).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000 + FALLBACK_RETRY_MS);
    const recovered = await loadUserAccess();
    expect(recovered?.permissions.has('feedback.view')).toBe(true);
    expect(await loadUserAccess()).toBe(recovered);
    expect(repo.GetMyAccess).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('returns null when nothing can be loaded', async () => {
    repo.GetMyAccess.mockRejectedValue(new Error('down'));
    repo.GetCurrentUser.mockRejectedValue(new Error('down'));
    await expect(loadUserAccess()).resolves.toBeNull();
  });

  it('notifies subscribers and clears on logout', async () => {
    repo.GetMyAccess.mockResolvedValue({ data: { role: 'USER' } });
    const listener = jest.fn();
    const unsubscribe = subscribeUserAccess(listener);
    await loadUserAccess();
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'USER' }));
    clearAuthenticatedSession();
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(getCachedUserAccess()).toBeNull();
    unsubscribe();
  });

  it('ignores a response that arrives after the session was cleared', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    repo.GetMyAccess.mockReturnValue(new Promise(r => (resolve = r)));
    const request = loadUserAccess();
    clearUserAccess();
    resolve({ data: { role: 'ADMIN' } });
    await request;
    expect(getCachedUserAccess()).toBeNull();
  });
});
