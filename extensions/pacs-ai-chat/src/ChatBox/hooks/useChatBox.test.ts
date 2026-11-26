import { renderHook, waitFor, act } from '@testing-library/react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import { useChatBox } from './useChatBox';

jest.mock('@pacs-ai/extension-core/src/api/orchestratorRepository', () => ({
  __esModule: true,
  default: {
    CreateThread: jest.fn(),
    CreateMessage: jest.fn(),
    UploadDicomPayload: jest.fn(),
  },
}));

const repository = orchestratorRepository as jest.Mocked<typeof orchestratorRepository>;

const OPEN_STUDY = {
  studyInstanceUID: '2.25.4242',
  modality: 'XA',
  seriesInstanceUIDs: ['2.25.4242.1', '2.25.4242.2'],
};

describe('useChatBox open-study context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    repository.CreateThread.mockResolvedValue({
      success: true,
      data: { thread_id: 'thread-1' },
    } as any);
    repository.UploadDicomPayload.mockResolvedValue({
      success: true,
      data: { status: 'success' },
    } as any);
    repository.CreateMessage.mockResolvedValue({
      success: true,
      data: { message: { role: 'assistant', content: 'ok' } },
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates the thread with the open study and uploads its DICOM payload', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY));

    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));

    expect(repository.CreateThread).toHaveBeenCalledWith({
      metadata: { studyInstanceUID: '2.25.4242', modality: 'XA' },
    });
    expect(repository.UploadDicomPayload).toHaveBeenCalledWith({
      threadId: 'thread-1',
      studyInstanceUID: '2.25.4242',
      seriesInstanceUIDs: ['2.25.4242.1', '2.25.4242.2'],
      additionalMetadata: { modality: 'XA', seriesCount: 2, source: 'viewer-open-study' },
    });
  });

  it('sends the open study with every message', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY));
    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));

    await act(async () => {
      await result.current.sendMessage('thread-1', 'What is the dominance?', []);
    });

    expect(repository.CreateMessage).toHaveBeenCalledWith({
      threadId: 'thread-1',
      message: 'What is the dominance?',
      metadata: { selectedSeries: [], studyInstanceUID: '2.25.4242', modality: 'XA' },
    });
  });

  it('reads the answer language from message.metadata and ignores unknown values', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY));
    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));
    repository.CreateMessage.mockResolvedValueOnce({
      success: true,
      data: {
        message: {
          role: 'assistant',
          content: 'Réponse',
          metadata: { response_language: 'fr', response_language_source: 'message_request' },
        },
      },
    } as any);
    let answer: Awaited<ReturnType<typeof result.current.sendMessage>> | undefined;
    await act(async () => {
      answer = await result.current.sendMessage('thread-1', 'en français', []);
    });
    expect(answer?.response_language).toBe('fr');
    expect(answer?.response_language_source).toBe('message_request');

    repository.CreateMessage.mockResolvedValueOnce({
      success: true,
      data: {
        message: { role: 'assistant', content: 'ok', metadata: { response_language: 'de' } },
      },
    } as any);
    await act(async () => {
      answer = await result.current.sendMessage('thread-1', 'hello', []);
    });
    expect(answer?.response_language).toBeUndefined();
  });

  it('lets an explicit study context override the open study', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY));
    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));

    await act(async () => {
      await result.current.sendMessage('thread-1', 'Analyze', ['2.25.9.1'], {
        studyInstanceUID: '2.25.9',
      });
    });

    expect(repository.CreateMessage.mock.calls[0][0].metadata).toEqual({
      selectedSeries: ['2.25.9.1'],
      studyInstanceUID: '2.25.9',
    });
  });

  it('keeps the previous behaviour when no study is open', async () => {
    const { result } = renderHook(() => useChatBox(true, 0, () => null));
    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));

    expect(repository.CreateThread).toHaveBeenCalledWith({});
    expect(repository.UploadDicomPayload).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.sendMessage('thread-1', 'hello', []);
    });
    expect(repository.CreateMessage.mock.calls[0][0].metadata).toEqual({ selectedSeries: [] });
  });

  it('does not block the chat when the DICOM upload fails', async () => {
    repository.UploadDicomPayload.mockRejectedValue(new Error('upload failed'));
    const { result } = renderHook(() => useChatBox(true, 0, () => OPEN_STUDY));

    await waitFor(() => expect(result.current.threadId).toBe('thread-1'));
    expect(result.current.errorDetails).toBe('');
  });
});
