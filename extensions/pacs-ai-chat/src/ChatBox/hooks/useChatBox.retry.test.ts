import { act, renderHook } from '@testing-library/react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import {
  THREAD_CREATE_MAX_ATTEMPTS,
  THREAD_RETRY_MAX_MS,
  isRetryableThreadError,
  threadRetryDelay,
  useChatBox,
} from './useChatBox';

jest.mock('@pacs-ai/extension-core/src/api/orchestratorRepository', () => ({
  __esModule: true,
  default: {
    CreateThread: jest.fn(),
    CreateMessage: jest.fn(),
    UploadDicomPayload: jest.fn(),
  },
}));
jest.mock('@pacs-ai/extension-core/src/service/appLanguage', () => ({
  chatResponseLanguage: () => undefined,
}));

const repository = orchestratorRepository as jest.Mocked<typeof orchestratorRepository>;

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

// No open study: the chat creates a new thread right away when it opens.
const renderOpenChat = () => renderHook(() => useChatBox(true, 0, () => null));

describe('chat thread creation retry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(1); // no jitter: full delays
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('backs off exponentially on 502, then stops and shows the chat as unavailable', async () => {
    repository.CreateThread.mockRejectedValue({ status: 502, message: 'Bad Gateway' });
    const { result } = renderOpenChat();

    await advance(0);
    expect(repository.CreateThread).toHaveBeenCalledTimes(1);

    // Nothing is sent before the backoff delay is over (the old code looped).
    await advance(999);
    expect(repository.CreateThread).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(repository.CreateThread).toHaveBeenCalledTimes(2);

    await advance(1999);
    expect(repository.CreateThread).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(repository.CreateThread).toHaveBeenCalledTimes(3);

    await advance(4000);
    expect(repository.CreateThread).toHaveBeenCalledTimes(4);
    await advance(8000);
    expect(repository.CreateThread).toHaveBeenCalledTimes(THREAD_CREATE_MAX_ATTEMPTS);

    // Attempts used up: no more requests, a clear unavailable state.
    await advance(10 * 60 * 1000);
    expect(repository.CreateThread).toHaveBeenCalledTimes(THREAD_CREATE_MAX_ATTEMPTS);
    expect(result.current.threadUnavailable).toBe(true);
    expect(result.current.threadId).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorDetails).toMatch(/unavailable/i);

    // Retry starts a fresh series and succeeds.
    repository.CreateThread.mockResolvedValue({ success: true, data: { thread_id: 'thread-9' } } as any);
    await act(async () => {
      result.current.handleRetryThreadCreation();
    });
    await advance(0);
    expect(repository.CreateThread).toHaveBeenCalledTimes(THREAD_CREATE_MAX_ATTEMPTS + 1);
    expect(result.current.threadId).toBe('thread-9');
    expect(result.current.threadUnavailable).toBe(false);
    expect(result.current.errorDetails).toBe('');
  });

  it('retries a network error (no status) and recovers when the backend is back', async () => {
    repository.CreateThread.mockRejectedValueOnce({ message: 'Network Error' }).mockResolvedValue({
      success: true,
      data: { thread_id: 'thread-2' },
    } as any);
    const { result } = renderOpenChat();

    await advance(0);
    expect(repository.CreateThread).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true); // still "initializing" while waiting
    await advance(1000);
    expect(repository.CreateThread).toHaveBeenCalledTimes(2);
    expect(result.current.threadId).toBe('thread-2');
    expect(result.current.threadUnavailable).toBe(false);
  });

  it('does not retry a 4xx other than 409', async () => {
    repository.CreateThread.mockRejectedValue({ status: 403, message: 'Forbidden' });
    const { result } = renderOpenChat();

    await advance(0);
    await advance(60 * 1000);
    expect(repository.CreateThread).toHaveBeenCalledTimes(1);
    expect(result.current.threadUnavailable).toBe(true);
    expect(result.current.errorDetails).toBe('Forbidden');
  });

  it('retries a 409', async () => {
    repository.CreateThread.mockRejectedValueOnce({ status: 409, message: 'busy' }).mockResolvedValue({
      success: true,
      data: { thread_id: 'thread-3' },
    } as any);
    const { result } = renderOpenChat();

    await advance(0);
    await advance(1000);
    expect(repository.CreateThread).toHaveBeenCalledTimes(2);
    expect(result.current.threadId).toBe('thread-3');
  });

  it('cancels a scheduled retry on unmount', async () => {
    repository.CreateThread.mockRejectedValue({ status: 500 });
    const { unmount } = renderOpenChat();
    await advance(0);
    unmount();
    await advance(60 * 1000);
    expect(repository.CreateThread).toHaveBeenCalledTimes(1);
  });
});

describe('retry policy helpers', () => {
  it('doubles the delay up to the cap, with 50-100 % jitter', () => {
    const full = () => 1;
    expect([0, 1, 2, 3, 4, 5, 6].map(a => threadRetryDelay(a, full))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
    expect(threadRetryDelay(10, () => 0)).toBe(THREAD_RETRY_MAX_MS / 2);
    expect(threadRetryDelay(0, () => 0.5)).toBe(750);
  });

  it('classifies errors', () => {
    expect(isRetryableThreadError({ status: 500 })).toBe(true);
    expect(isRetryableThreadError({ status: 502 })).toBe(true);
    expect(isRetryableThreadError({ status: 409 })).toBe(true);
    expect(isRetryableThreadError({ status: 429 })).toBe(true);
    expect(isRetryableThreadError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableThreadError({ message: 'Network Error' })).toBe(true);
    expect(isRetryableThreadError(undefined)).toBe(true);
    expect(isRetryableThreadError({ status: 400 })).toBe(false);
    expect(isRetryableThreadError({ status: 401 })).toBe(false);
    expect(isRetryableThreadError({ status: 404 })).toBe(false);
  });
});
