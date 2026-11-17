import { renderHook, act } from '@testing-library/react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import { useChatBox, PROGRESS_POLL_INTERVAL_MS } from './useChatBox';

jest.mock('@pacs-ai/extension-core/src/api/orchestratorRepository', () => ({
  __esModule: true,
  default: {
    CreateThread: jest.fn(),
    CreateMessage: jest.fn(),
    UploadDicomPayload: jest.fn(),
    GetChatProgress: jest.fn(),
  },
}));

const repository = orchestratorRepository as jest.Mocked<typeof orchestratorRepository>;

const STEP_ONE = {
  id: 1,
  key: 'delegate_angiogram',
  kind: 'delegation',
  label: 'Consulting the angiography specialist',
  model: null,
  status: 'running',
};
const STEP_TWO = {
  id: 2,
  key: 'model_result',
  kind: 'tool',
  label: 'Reading the stored DeepCORO-JEPA result',
  model: 'DeepCORO-JEPA',
  status: 'running',
};

const progressResponse = (steps: any[], active = true) =>
  ({
    success: true,
    data: {
      thread_id: 'thread-1',
      active,
      status: active ? 'running' : 'done',
      elapsed_ms: 1000,
      steps,
    },
  }) as any;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const chatAnswer = (extra: Record<string, unknown> = {}) =>
  ({
    success: true,
    data: { status: 'success', message: { role: 'assistant', content: 'summary' }, ...extra },
  }) as any;

async function tick(milliseconds = PROGRESS_POLL_INTERVAL_MS) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('useChatBox live progress', () => {
  let pending: ReturnType<typeof deferred<any>>;

  // The chat is closed (isOpen false) so no thread is created on mount.
  const renderChat = () => renderHook(() => useChatBox(false, 0, () => null));

  const send = (result: { current: ReturnType<typeof useChatBox> }) => {
    let sent!: Promise<any>;
    act(() => {
      sent = result.current.sendMessage('thread-1', 'Summarize all findings', []);
      sent.catch(() => undefined);
    });
    return sent;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    pending = deferred<any>();
    repository.CreateMessage.mockImplementation(() => pending.promise);
    repository.GetChatProgress.mockResolvedValue(progressResponse([STEP_ONE]));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not poll when no message is in flight', async () => {
    const { result } = renderChat();

    await tick(5000);

    expect(repository.GetChatProgress).not.toHaveBeenCalled();
    expect(result.current.progress).toBeNull();
  });

  it('polls about once a second while the message is in flight and exposes the steps', async () => {
    const { result } = renderChat();
    send(result);

    expect(repository.GetChatProgress).not.toHaveBeenCalled();
    expect(result.current.progress).toBeNull();

    await tick();
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(1);
    expect(repository.GetChatProgress).toHaveBeenCalledWith({ threadId: 'thread-1' });
    expect(result.current.progress?.steps.map(step => step.label)).toEqual([
      'Consulting the angiography specialist',
    ]);

    repository.GetChatProgress.mockResolvedValue(
      progressResponse([{ ...STEP_ONE }, { ...STEP_TWO }])
    );
    await tick();
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(2);
    expect(result.current.progress?.steps).toHaveLength(2);
    expect(result.current.progress?.steps[1].model).toBe('DeepCORO-JEPA');

    await tick(3000);
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(5);
  });

  it('stops polling on completion and returns the completed steps with the answer', async () => {
    const { result } = renderChat();
    const sent = send(result);
    await tick();
    expect(result.current.progress).not.toBeNull();

    const activity = {
      status: 'done',
      elapsed_ms: 58000,
      steps: [{ ...STEP_ONE, status: 'done', duration_ms: 47000 }],
    };
    let response: any;
    await act(async () => {
      pending.resolve(chatAnswer({ activity }));
      response = await sent;
    });

    expect(response.content).toBe('summary');
    expect(response.activity).toEqual({
      status: 'done',
      started_at: undefined,
      ended_at: undefined,
      elapsed_ms: 58000,
      steps: activity.steps,
    });
    expect(result.current.progress).toBeNull();
    expect(result.current.isProcessing).toBe(false);

    const calls = repository.GetChatProgress.mock.calls.length;
    await tick(5000);
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(calls);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns no activity when the backend sends none (older backend)', async () => {
    const { result } = renderChat();
    const sent = send(result);

    let response: any;
    await act(async () => {
      pending.resolve(chatAnswer());
      response = await sent;
    });

    expect(response.content).toBe('summary');
    expect(response.activity).toBeUndefined();
    expect(response.citations).toBeUndefined();
  });

  it('returns the citations of the answer with it', async () => {
    const { result } = renderChat();
    const sent = send(result);
    const citations = [
      {
        index: 1,
        kind: 'model_result',
        modelName: 'DeepCORO-JEPA',
        modelVersion: '2.0.0',
        completedAt: '2026-11-13 09:00:00',
        studyInstanceUID: '2.25.9',
        studyServiceJobId: 'job-1',
        title: 'DeepCORO-JEPA',
        summary: 'Coronary reading',
        outputMode: null,
      },
      { index: 2, kind: 'web_source', title: '2024 ESC Guidelines', url: 'https://example.org/g' },
    ];

    let response: any;
    await act(async () => {
      pending.resolve(chatAnswer({ citations: [...citations, { index: 3, kind: 'unknown' }] }));
      response = await sent;
    });

    expect(response.citations).toEqual(citations);
  });

  it('stops polling when the message fails', async () => {
    const { result } = renderChat();
    const sent = send(result);
    await tick();

    await act(async () => {
      pending.reject({ success: false, message: 'boom' });
      await sent.catch(() => undefined);
    });

    expect(result.current.progress).toBeNull();
    const calls = repository.GetChatProgress.mock.calls.length;
    await tick(5000);
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(calls);
  });

  it('stops polling on unmount', async () => {
    const { result, unmount } = renderChat();
    send(result);
    await tick();
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(1);

    unmount();
    await tick(5000);

    expect(repository.GetChatProgress).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('falls back silently and stops asking when the endpoint is missing', async () => {
    repository.GetChatProgress.mockRejectedValue({ status: 404 });
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderChat();
    const sent = send(result);

    await tick(4000);

    expect(repository.GetChatProgress).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toBeNull();
    expect(result.current.errorDetails).toBe('');
    expect(result.current.isProcessing).toBe(true); // the message itself is unaffected

    await act(async () => {
      pending.resolve(chatAnswer());
      await sent;
    });

    // The next message does not probe the missing endpoint again.
    pending = deferred<any>();
    send(result);
    await tick(3000);
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('treats the api-pacs "unsupported" error code like a missing endpoint', async () => {
    repository.GetChatProgress.mockRejectedValue({ errorCode: 'chat_progress_unsupported' });
    const { result } = renderChat();
    send(result);

    await tick(4000);

    expect(repository.GetChatProgress).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toBeNull();
  });

  it('keeps the last steps through one failed poll and gives up after three in a row', async () => {
    const { result } = renderChat();
    send(result);
    await tick();
    expect(result.current.progress?.steps).toHaveLength(1);

    repository.GetChatProgress.mockRejectedValue({ status: 502 });
    await tick();
    expect(result.current.progress?.steps).toHaveLength(1);
    await tick(2000);
    expect(result.current.progress).toBeNull();

    const calls = repository.GetChatProgress.mock.calls.length;
    expect(calls).toBe(4);
    await tick(5000);
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(calls);

    // A transient outage does not disable progress for the next message.
    await act(async () => {
      pending.resolve(chatAnswer());
    });
    pending = deferred<any>();
    repository.GetChatProgress.mockResolvedValue(progressResponse([STEP_ONE]));
    send(result);
    await tick();
    expect(result.current.progress?.steps).toHaveLength(1);
  });

  it('ignores a poll that reports no request in flight', async () => {
    // For instance the previous answer of the thread, still readable for a few seconds.
    repository.GetChatProgress.mockResolvedValue(progressResponse([STEP_ONE], false));
    const { result } = renderChat();
    send(result);

    await tick(2000);

    expect(repository.GetChatProgress).toHaveBeenCalledTimes(2);
    expect(result.current.progress).toBeNull();
  });

  it('does not stack requests when a poll is slow', async () => {
    const slow = deferred<any>();
    repository.GetChatProgress.mockImplementation(() => slow.promise);
    const { result } = renderChat();
    send(result);

    await tick(4000);
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(1);

    repository.GetChatProgress.mockResolvedValue(progressResponse([STEP_ONE]));
    await act(async () => {
      slow.resolve(progressResponse([STEP_ONE]));
    });
    await tick();
    expect(repository.GetChatProgress).toHaveBeenCalledTimes(2);
  });

  it('drops a progress answer that arrives after the message completed', async () => {
    const slow = deferred<any>();
    repository.GetChatProgress.mockImplementation(() => slow.promise);
    const { result } = renderChat();
    const sent = send(result);
    await tick();

    await act(async () => {
      pending.resolve(chatAnswer());
      await sent;
    });
    await act(async () => {
      slow.resolve(progressResponse([STEP_ONE]));
    });

    expect(result.current.progress).toBeNull();
  });
});
