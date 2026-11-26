import { useState, useCallback, useEffect, useRef } from 'react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import type { ChatThreadSummary } from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import type { ChatActivity, ChatCitation, Message, ModalityData } from '../types';
import type { ChatFeedbackEntry } from './useChatFeedback';
import { toCitations } from '../utils/citations';
import { historyToFeedback, historyToMessages } from '../utils/chatHistory';
import { openStudyMetadata } from '../utils/getOpenStudyContext';
import type { OpenStudyContext } from '../utils/getOpenStudyContext';

interface SendMessageResponse {
  message_id?: string;
  // Stored id of the answer in the chat backend (chat feedback targets it).
  assistant_message_id?: string;
  response_id?: string;
  content: string;
  role: string;
  thread_id?: string;
  created_at?: string;
  completed_at?: string;
  user_content?: string;
  metadata?: any;
  status?: string;
  error?: string;
  tool_results?: any[];
  activity?: ChatActivity;
  // What the "[n]" markers of the answer refer to; absent when it has none.
  citations?: ChatCitation[];
}

// A restored thread: its messages and the signed-in user's votes on them.
export interface RestoredChat {
  messages: Message[];
  feedback: Record<string, ChatFeedbackEntry>;
}

// Earlier threads listed for the open study.
export const CHAT_HISTORY_LIMIT = 20;

// Live progress is polled about once a second while a message is in flight.
export const PROGRESS_POLL_INTERVAL_MS = 1000;
// Consecutive failed polls after which polling stops for the current message.
const PROGRESS_MAX_FAILURES = 3;

/** A usable activity object, or undefined for anything else the server sent. */
function toActivity(value: any): ChatActivity | undefined {
  if (!value || !Array.isArray(value.steps)) {
    return undefined;
  }
  return {
    status: value.status,
    started_at: value.started_at,
    ended_at: value.ended_at,
    elapsed_ms: value.elapsed_ms,
    steps: value.steps.filter(
      (step: any) => step && typeof step.label === 'string' && typeof step.key === 'string'
    ),
  };
}

interface UseChatBoxReturn {
  threadId: string | null;
  isLoading: boolean;
  isProcessing: boolean;
  errorDetails: string;
  thinkingMessageId: string | null;
  // Steps so far of the message in flight; null when none is known (no request,
  // older backend, or the progress endpoint failing): show the plain indicator.
  progress: ChatActivity | null;
  threadCreationPending: boolean;
  createThread: () => Promise<void>;
  sendMessage: (
    threadId: string,
    message: string,
    selectedSeries: string[],
    studyContext?: Record<string, string>
  ) => Promise<SendMessageResponse>;
  uploadDicomPayload: (
    threadId: string,
    studyInstanceUID: string,
    seriesInstanceUIDs: string[],
    selectedModalities: Record<string, ModalityData>
  ) => Promise<any>;
  setErrorDetails: (error: string) => void;
  handleRetryThreadCreation: () => void;
  resetThread: () => void;
  // The signed-in user's earlier threads about the open study, latest first.
  threads: ChatThreadSummary[];
  // True while a stored thread is being opened.
  historyLoading: boolean;
  // Reload the list of earlier threads.
  refreshThreads: () => Promise<ChatThreadSummary[] | null>;
  // Open a stored thread and continue it; resolves false when it could not be loaded.
  openThread: (threadId: string) => Promise<boolean>;
}

/**
 * Attach the viewer's open study to a new thread: its StudyInstanceUID goes in the
 * thread metadata, and a DICOM payload is uploaded so agents that only read
 * /dicom payloads also see it. Best effort: a failed upload never blocks chat.
 */
async function attachOpenStudy(threadId: string, openStudy: OpenStudyContext | null) {
  if (!openStudy || openStudy.seriesInstanceUIDs.length === 0) {
    return;
  }
  try {
    await orchestratorRepository.UploadDicomPayload({
      threadId,
      studyInstanceUID: openStudy.studyInstanceUID,
      seriesInstanceUIDs: openStudy.seriesInstanceUIDs,
      additionalMetadata: {
        modality: openStudy.modality || undefined,
        seriesCount: openStudy.seriesInstanceUIDs.length,
        source: 'viewer-open-study',
      },
    });
  } catch (error) {
    console.warn('Could not attach the open study to the chat thread:', error);
  }
}

export function useChatBox(
  isOpen: boolean,
  messagesLength: number,
  getOpenStudy?: () => OpenStudyContext | null,
  // Without it the chat box never restores a stored thread (always a new one).
  onRestore?: (restored: RestoredChat) => void
): UseChatBoxReturn {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadCreationPending, setThreadCreationPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ChatActivity | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set once the backend answers that it has no progress endpoint.
  const progressUnsupported = useRef(false);
  const isMounted = useRef(true);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // The latest stored thread is restored once per mount; "New chat" then starts fresh.
  const restoreTried = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const stopProgressPolling = useCallback(() => {
    if (progressTimer.current !== null) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  const startProgressPolling = useCallback(
    (currentThreadId: string) => {
      stopProgressPolling();
      if (
        progressUnsupported.current ||
        typeof orchestratorRepository.GetChatProgress !== 'function'
      ) {
        return;
      }
      let failures = 0;
      let pollInFlight = false;
      const timer = setInterval(async () => {
        if (pollInFlight) {
          return;
        }
        pollInFlight = true;
        try {
          const response = await orchestratorRepository.GetChatProgress({
            threadId: currentThreadId,
          });
          if (progressTimer.current !== timer || !isMounted.current) {
            return; // the message completed (or the chat closed) meanwhile
          }
          failures = 0;
          const activity =
            response?.success && response.data?.active ? toActivity(response.data) : undefined;
          if (activity) {
            setProgress(activity);
          }
        } catch (error: any) {
          if (progressTimer.current !== timer) {
            return;
          }
          failures += 1;
          const unsupported =
            error?.status === 404 ||
            error?.status === 405 ||
            error?.errorCode === 'chat_progress_unsupported';
          if (unsupported) {
            progressUnsupported.current = true;
          }
          if (unsupported || failures >= PROGRESS_MAX_FAILURES) {
            // Fall back silently to the plain thinking indicator.
            stopProgressPolling();
            if (isMounted.current) {
              setProgress(null);
            }
          }
        } finally {
          pollInFlight = false;
        }
      }, PROGRESS_POLL_INTERVAL_MS);
      progressTimer.current = timer;
    },
    [stopProgressPolling]
  );

  // Stop polling when the chat unmounts.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      stopProgressPolling();
    };
  }, [stopProgressPolling]);

  // Creates a new thread, without the pending guard (the initializer sets it first).
  const startThread = useCallback(async () => {
    try {
      setThreadCreationPending(true);
      setIsLoading(true);
      setErrorDetails('');
      console.log('Creating thread...');

      const openStudy = getOpenStudy?.() ?? null;
      const metadata = openStudyMetadata(openStudy);
      const response = await orchestratorRepository.CreateThread(metadata ? { metadata } : {});

      if (response.success && response.data) {
        const newThreadId = response.data.thread_id;

        if (newThreadId) {
          console.log('Thread created with ID:', newThreadId);
          await attachOpenStudy(newThreadId, openStudy);
          setThreadId(newThreadId);
          setErrorDetails('');
        } else {
          console.error('Thread ID not found in response:', response);
          setErrorDetails('Thread ID not found in server response');
        }
      } else {
        console.error('Invalid response format:', response);
        const errorMsg = response.message || 'Invalid response format from server';
        setErrorDetails(errorMsg);
      }
    } catch (error: any) {
      console.error('Error creating thread:', error);

      let errorMessage = 'Unknown error occurred while creating thread';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.statusText) {
        errorMessage = `HTTP Error: ${error.response.statusText}`;
      }

      setErrorDetails(errorMessage);

      if (error.response?.status >= 500 || error.code === 'NETWORK_ERROR') {
        console.log('Network or server error detected, will retry in 3 seconds...');
        setTimeout(() => {
          setThreadCreationPending(false);
          setErrorDetails('');
        }, 3000);
      } else {
        setThreadCreationPending(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [getOpenStudy]);

  // Function to create a new thread
  const createThread = useCallback(async () => {
    if (threadCreationPending) return;
    await startThread();
  }, [threadCreationPending, startThread]);

  // The signed-in user's earlier threads about the open study (none without a study).
  const refreshThreads = useCallback(async (): Promise<ChatThreadSummary[] | null> => {
    const studyInstanceUID = getOpenStudy?.()?.studyInstanceUID;
    if (!studyInstanceUID || typeof orchestratorRepository.ListChatThreads !== 'function') {
      return null;
    }
    try {
      const response = await orchestratorRepository.ListChatThreads({
        studyInstanceUID,
        limit: CHAT_HISTORY_LIMIT,
      });
      const list =
        response?.success && Array.isArray(response.data?.threads) ? response.data.threads : [];
      if (isMounted.current) {
        setThreads(list);
      }
      return list;
    } catch (error) {
      // An older gateway or chat service: no history, chat works as before.
      console.warn('Could not load the earlier chats of this study.');
      return null;
    }
  }, [getOpenStudy]);

  // Opens a stored thread: its messages and votes replace the chat box content.
  const openThread = useCallback(async (storedThreadId: string): Promise<boolean> => {
    if (!onRestoreRef.current) {
      return false;
    }
    setHistoryLoading(true);
    try {
      const response = await orchestratorRepository.GetChatThreadHistory({
        threadId: storedThreadId,
      });
      if (!response?.success || !response.data || !isMounted.current) {
        return false;
      }
      onRestoreRef.current?.({
        messages: historyToMessages(response.data),
        feedback: historyToFeedback(response.data),
      });
      setErrorDetails('');
      setThreadId(storedThreadId);
      return true;
    } catch (error) {
      console.warn('Could not open the earlier chat.');
      return false;
    } finally {
      if (isMounted.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  // Function to send a message to the backend
  const sendMessage = useCallback(
    async (
      currentThreadId: string,
      message: string,
      selectedSeries: string[],
      studyContext?: Record<string, string>
    ): Promise<SendMessageResponse> => {
      try {
        setIsLoading(true);
        setIsProcessing(true);
        setProgress(null);
        startProgressPolling(currentThreadId);

        const response = await orchestratorRepository.CreateMessage({
          threadId: currentThreadId,
          message,
          metadata: {
            selectedSeries: selectedSeries,
            ...(studyContext || openStudyMetadata(getOpenStudy?.() ?? null) || {}),
          },
        });

        if (response.success) {
          const responseData = response.data;
          const responseText = responseData.message?.content || responseData.response || '';

          return {
            message_id: responseData.message_id,
            assistant_message_id: responseData.assistant_message_id,
            response_id: responseData.response_id,
            content: responseText,
            role: responseData.message?.role || 'assistant',
            thread_id: responseData.thread_id,
            created_at: responseData.created_at,
            completed_at: responseData.completed_at,
            user_content: responseData.content,
            metadata: responseData.metadata,
            status: responseData.status,
            error: responseData.error,
            tool_results: responseData.message?.tool_results || [],
            activity: toActivity(responseData.activity),
            citations: toCitations(responseData.citations),
          };
        } else {
          throw new Error(response.message || 'Failed to send message');
        }
      } finally {
        stopProgressPolling();
        if (isMounted.current) {
          setProgress(null);
          setIsLoading(false);
          setIsProcessing(false);
        }
      }
    },
    [getOpenStudy, startProgressPolling, stopProgressPolling]
  );

  // Function to upload DICOM payload
  const uploadDicomPayload = useCallback(
    async (
      currentThreadId: string,
      studyInstanceUID: string,
      seriesInstanceUIDs: string[],
      selectedModalities: Record<string, ModalityData>
    ) => {
      try {
        let modality = '';
        let previewImageBase64 = '';
        const modalities = new Set<string>();

        for (const modalityData of Object.values(selectedModalities)) {
          if (modalityData.displaySets) {
            const matchingSeries = modalityData.displaySets.filter(series =>
              seriesInstanceUIDs.includes(series.SeriesInstanceUID || '')
            );

            matchingSeries.forEach(series => {
              const seriesModality =
                series.Modality || series.modality || modalityData.modality || '';
              if (seriesModality) {
                modalities.add(seriesModality);
              }

              if (!previewImageBase64) {
                const imageSource = series.thumbnailSrc || series.imageSrc;
                if (imageSource && imageSource.startsWith('data:image/')) {
                  const base64Match = imageSource.match(/^data:image\/[^;]+;base64,(.+)$/);
                  if (base64Match) {
                    previewImageBase64 = base64Match[1];
                  }
                }
              }
            });
          }
        }

        modality = Array.from(modalities).join(', ') || '';

        console.log('Uploading DICOM payload:', {
          studyInstanceUID,
          seriesInstanceUIDs,
          modality,
          hasPreviewImage: !!previewImageBase64,
        });

        const response = await orchestratorRepository.UploadDicomPayload({
          threadId: currentThreadId,
          studyInstanceUID,
          seriesInstanceUIDs,
          additionalMetadata: {
            modality,
            previewImageBase64: previewImageBase64 || undefined,
            seriesCount: seriesInstanceUIDs.length,
            timestamp: new Date().toISOString(),
          },
        });

        if (response.success && response.data) {
          const responseData = response.data;

          if (responseData.status === 'success' || responseData.success) {
            return {
              thread_id: responseData.thread_id,
              status: responseData.status,
              message: responseData.message,
              success: responseData.success,
            };
          } else {
            const errorMsg = responseData.message || 'DICOM payload upload failed';
            throw new Error(errorMsg);
          }
        } else {
          const errorMsg = response.message || 'Failed to upload DICOM payload';
          throw new Error(errorMsg);
        }
      } catch (error: any) {
        console.error('Error uploading DICOM payload:', error);

        let errorMessage = 'Failed to upload DICOM payload';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }

        throw new Error(errorMessage);
      }
    },
    []
  );

  // Initialize the thread when the chat opens or is reset: once per mount, the
  // user's latest thread about the open study is restored; otherwise (none, no
  // study, an older backend, or after "New chat") a new thread is created.
  useEffect(() => {
    if (!isOpen || threadId || threadCreationPending) {
      return;
    }
    const restore = !restoreTried.current && !!onRestoreRef.current;
    if (!restore && messagesLength > 0) {
      return;
    }
    restoreTried.current = true;
    setThreadCreationPending(true);
    (async () => {
      if (restore) {
        setIsLoading(true);
        const list = await refreshThreads();
        const restored = list && list.length > 0 ? await openThread(list[0].thread_id) : false;
        if (isMounted.current) {
          setIsLoading(false);
        }
        if (restored || !isMounted.current) {
          return;
        }
      }
      await startThread();
    })();
  }, [isOpen, threadId, messagesLength, threadCreationPending, refreshThreads, openThread, startThread]);

  // Reset thread creation pending when threadId is set
  useEffect(() => {
    if (threadId) {
      setThreadCreationPending(false);
    }
  }, [threadId]);

  const handleRetryThreadCreation = useCallback(() => {
    setThreadCreationPending(false);
    setThreadId(null);
    createThread();
  }, [createThread]);

  const resetThread = useCallback(() => {
    setThreadId(null);
  }, []);

  return {
    threadId,
    isLoading,
    isProcessing,
    errorDetails,
    thinkingMessageId,
    progress,
    threadCreationPending,
    createThread,
    sendMessage,
    uploadDicomPayload,
    setErrorDetails,
    handleRetryThreadCreation,
    resetThread,
    threads,
    historyLoading,
    refreshThreads,
    openThread,
  };
}
