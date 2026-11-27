import { renderHook, waitFor, act } from '@testing-library/react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import { lastThreadOf, useChatBox } from './useChatBox';
import type { RestoredChat } from './useChatBox';

jest.mock('@pacs-ai/extension-core/src/api/orchestratorRepository', () => ({
  __esModule: true,
  default: {
    CreateThread: jest.fn(),
    CreateMessage: jest.fn(),
    UploadDicomPayload: jest.fn(),
    ListChatThreads: jest.fn(),
    GetChatThreadHistory: jest.fn(),
  },
}));

const repository = orchestratorRepository as jest.Mocked<typeof orchestratorRepository>;
const OPEN_STUDY = { studyInstanceUID: '2.25.777', modality: 'XA', seriesInstanceUIDs: ['2.25.777.1'] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function answer(content: string) {
  return { success: true, data: { message: { role: 'assistant', content }, status: 'success' } } as any;
}

function history(threadId: string, messages: any[] = []) {
  return { success: true, data: { thread_id: threadId, title: '', messages, feedback: [] } } as any;
}

describe('useChatBox: New chat while an answer is running', () => {
  let created = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    created = 0;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    repository.CreateThread.mockImplementation(
      async () => ({ success: true, data: { thread_id: `thread-${++created}` } }) as any
    );
    repository.UploadDicomPayload.mockResolvedValue({ success: true, data: { status: 'success' } } as any);
    repository.ListChatThreads.mockResolvedValue({ success: true, data: { threads: [] } } as any);
    repository.GetChatThreadHistory.mockImplementation(async ({ threadId }) => history(threadId));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('frees the input at once, keeps the new thread, and drops the old answer', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));

    const first = deferred<any>();
    repository.CreateMessage.mockReturnValueOnce(first.promise);
    let firstResult: any;
    act(() => {
      result.current
        .sendMessage('thread-1', 'Summarize all findings', [])
        .then(value => (firstResult = value));
    });
    await waitFor(() => expect(result.current.isProcessing).toBe(true));

    // New chat while the answer is still running.
    act(() => result.current.resetThread());
    expect(result.current.isProcessing).toBe(false);
    await waitFor(() => expect(result.current.threadId).toBe('thread-2'));
    expect(result.current.isProcessing).toBe(false);

    // The next question goes to the new thread.
    const second = deferred<any>();
    repository.CreateMessage.mockReturnValueOnce(second.promise);
    let secondResult: any;
    act(() => {
      result.current
        .sendMessage(result.current.threadId as string, 'Write the dictation', [])
        .then(value => (secondResult = value));
    });
    expect(repository.CreateMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ threadId: 'thread-2', message: 'Write the dictation' })
    );

    // The old answer arrives: it is marked superseded and does not free the new one's input.
    await act(async () => first.resolve(answer('old answer')));
    await waitFor(() => expect(firstResult).toBeDefined());
    expect(firstResult.superseded).toBe(true);
    expect(firstResult.content).toBe('');
    expect(result.current.isProcessing).toBe(true);

    await act(async () => second.resolve(answer('new answer')));
    await waitFor(() => expect(secondResult?.content).toBe('new answer'));
    expect(secondResult.superseded).toBeUndefined();
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.threadId).toBe('thread-2');
  });

  it('drops a failure of the old answer too (no error in the new chat)', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));
    const first = deferred<any>();
    repository.CreateMessage.mockReturnValueOnce(first.promise);
    let outcome: any;
    act(() => {
      result.current.sendMessage('thread-1', 'q', []).then(
        value => (outcome = value),
        error => (outcome = { error })
      );
    });
    act(() => result.current.resetThread());
    await act(async () => first.reject({ success: false, errorCode: 'chat_upstream_error' }));
    await waitFor(() => expect(outcome).toBeDefined());
    expect(outcome.superseded).toBe(true);
  });

  it('restores the thread last used on this study, even when it has no message yet', async () => {
    const first = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(first.result.current.threadId).toBe('thread-1'));
    act(() => first.result.current.resetThread());
    await waitFor(() => expect(first.result.current.threadId).toBe('thread-2'));
    expect(lastThreadOf(OPEN_STUDY.studyInstanceUID)).toBe('thread-2');
    first.unmount();

    // The study's latest thread with messages is the older one; the new empty one wins.
    repository.ListChatThreads.mockResolvedValue({
      success: true,
      data: { threads: [{ thread_id: 'thread-1', title: 'Q', message_count: 2 }] },
    } as any);
    const onRestore = jest.fn<void, [RestoredChat]>();
    const again = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, onRestore));
    await waitFor(() => expect(again.result.current.threadId).toBe('thread-2'));
    expect(repository.GetChatThreadHistory).toHaveBeenCalledWith({ threadId: 'thread-2' });
    expect(repository.GetChatThreadHistory).not.toHaveBeenCalledWith({ threadId: 'thread-1' });
    expect(onRestore.mock.calls[0][0].messages).toEqual([]);
    expect(created).toBe(2);
  });

  it('falls back to the latest thread when the last one cannot be opened', async () => {
    window.localStorage.setItem('pacsAiChat.lastThread.2.25.777', 'gone');
    repository.ListChatThreads.mockResolvedValue({
      success: true,
      data: { threads: [{ thread_id: 'latest', title: 'Q', message_count: 2 }] },
    } as any);
    repository.GetChatThreadHistory.mockImplementation(async ({ threadId }) => {
      if (threadId === 'gone') {
        throw { success: false, errorCode: 'MISSING_RECORD' };
      }
      return history(threadId);
    });
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(result.current.threadId).toBe('latest'));
    expect(repository.CreateThread).not.toHaveBeenCalled();
  });

  it('remembers the thread a message is sent in', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));
    window.localStorage.clear();
    repository.CreateMessage.mockResolvedValueOnce(answer('ok'));
    await act(() => result.current.sendMessage('thread-1', 'q', []));
    expect(lastThreadOf(OPEN_STUDY.studyInstanceUID)).toBe('thread-1');
  });
});
