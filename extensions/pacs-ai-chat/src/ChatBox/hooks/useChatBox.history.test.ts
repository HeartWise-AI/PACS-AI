import { renderHook, waitFor, act } from '@testing-library/react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import { useChatBox } from './useChatBox';
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

const OPEN_STUDY = { studyInstanceUID: '2.25.4242', modality: 'XA', seriesInstanceUIDs: ['2.25.4242.1'] };
const CARD = '```cardio-card\n{"type":"dictation","sections":[]}\n```';

function history(threadId: string) {
  return {
    success: true,
    data: {
      thread_id: threadId,
      title: 'Question',
      study_instance_uid: OPEN_STUDY.studyInstanceUID,
      messages: [
        { message_id: `${threadId}-q`, role: 'user', content: 'Question', created_at: '2026-11-26T10:00:00' },
        {
          message_id: `${threadId}-a`,
          role: 'assistant',
          content: `Answer [1]\n\n${CARD}\n`,
          created_at: '2026-11-26T10:01:00',
          citations: [{ index: 1, kind: 'web_source', title: 'Guideline', url: 'https://example.org' }],
        },
      ],
      feedback: [{ message_id: `${threadId}-a`, vote: 'down', category: 'other', has_comment: true }],
    },
  } as any;
}

describe('useChatBox chat history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    repository.CreateThread.mockResolvedValue({ success: true, data: { thread_id: 'new-thread' } } as any);
    repository.UploadDicomPayload.mockResolvedValue({ success: true, data: { status: 'success' } } as any);
    repository.ListChatThreads.mockResolvedValue({
      success: true,
      data: {
        threads: [
          { thread_id: 'latest', title: 'Latest', message_count: 2, last_message_at: '2026-11-26T10:01:00' },
          { thread_id: 'older', title: 'Older', message_count: 4, last_message_at: '2026-11-20T09:00:00' },
        ],
      },
    } as any);
    repository.GetChatThreadHistory.mockImplementation(async ({ threadId }) => history(threadId));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores the latest thread of the open study instead of creating one', async () => {
    const onRestore = jest.fn<void, [RestoredChat]>();
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, onRestore));

    await waitFor(() => expect(result.current.threadId).toBe('latest'));
    expect(repository.ListChatThreads).toHaveBeenCalledWith({ studyInstanceUID: '2.25.4242', limit: 20 });
    expect(repository.GetChatThreadHistory).toHaveBeenCalledWith({ threadId: 'latest' });
    expect(repository.CreateThread).not.toHaveBeenCalled();
    expect(result.current.threads.map(t => t.thread_id)).toEqual(['latest', 'older']);

    const restored = onRestore.mock.calls[0][0];
    expect(restored.messages.map(m => m.sender)).toEqual(['user', 'assistant']);
    const answer = restored.messages[1];
    // The stored text keeps its card block, so the cards render again.
    expect(answer.text).toContain('```cardio-card');
    expect(answer.backendMessageId).toBe('latest-a');
    expect(answer.backendThreadId).toBe('latest');
    expect(answer.citations?.[0]).toMatchObject({ index: 1, kind: 'web_source' });
    expect(restored.feedback['latest-a']).toMatchObject({ vote: 'down', status: 'saved', detailsSaved: true });
  });

  it('creates a thread when the study has no earlier chat', async () => {
    repository.ListChatThreads.mockResolvedValue({ success: true, data: { threads: [] } } as any);
    const onRestore = jest.fn();
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, onRestore));

    await waitFor(() => expect(result.current.threadId).toBe('new-thread'));
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('falls back to a new thread when the history cannot be loaded', async () => {
    repository.ListChatThreads.mockRejectedValue({ status: 503 });
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));

    await waitFor(() => expect(result.current.threadId).toBe('new-thread'));
  });

  it('starts a new thread after "New chat" without restoring again', async () => {
    let messagesLength = 0;
    const { result, rerender } = renderHook(() => useChatBox(true, messagesLength, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(result.current.threadId).toBe('latest'));

    messagesLength = 2;
    rerender();
    messagesLength = 0;
    act(() => result.current.resetThread());
    rerender();

    await waitFor(() => expect(result.current.threadId).toBe('new-thread'));
    expect(repository.ListChatThreads).toHaveBeenCalledTimes(1);
    expect(repository.GetChatThreadHistory).toHaveBeenCalledTimes(1);
  });

  it('switches to an earlier thread', async () => {
    const onRestore = jest.fn<void, [RestoredChat]>();
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, onRestore));
    await waitFor(() => expect(result.current.threadId).toBe('latest'));

    let opened = false;
    await act(async () => {
      opened = await result.current.openThread('older');
    });
    expect(opened).toBe(true);
    expect(result.current.threadId).toBe('older');
    expect(onRestore).toHaveBeenLastCalledWith(
      expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ id: 'older-a' })]) })
    );
  });

  it('keeps the current thread when an earlier one cannot be opened', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(result.current.threadId).toBe('latest'));

    repository.GetChatThreadHistory.mockRejectedValueOnce({ status: 404 });
    let opened = true;
    await act(async () => {
      opened = await result.current.openThread('gone');
    });
    expect(opened).toBe(false);
    expect(result.current.threadId).toBe('latest');
  });

  it('clears messages kept from a remount when no thread can be restored', async () => {
    repository.ListChatThreads.mockResolvedValue({ success: true, data: { threads: [] } } as any);
    const onRestore = jest.fn<void, [RestoredChat]>();
    const { result } = renderHook(() => useChatBox(true, 3, () => OPEN_STUDY, onRestore));

    await waitFor(() => expect(result.current.threadId).toBe('new-thread'));
    expect(onRestore).toHaveBeenCalledWith({ messages: [], feedback: {} });
  });

  it('marks the history as loading while a thread is being opened', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY, jest.fn()));
    await waitFor(() => expect(result.current.threadId).toBe('latest'));

    let release: (value: any) => void = () => undefined;
    repository.GetChatThreadHistory.mockImplementationOnce(
      () => new Promise(resolve => (release = resolve))
    );
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.openThread('older');
    });
    await waitFor(() => expect(result.current.historyLoading).toBe(true));
    await act(async () => {
      release(history('older'));
      await pending;
    });
    expect(result.current.historyLoading).toBe(false);
    expect(result.current.threadId).toBe('older');
  });

  it('never restores without a restore handler (no history UI)', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY));
    await waitFor(() => expect(result.current.threadId).toBe('new-thread'));
    expect(repository.ListChatThreads).not.toHaveBeenCalled();
  });
});
