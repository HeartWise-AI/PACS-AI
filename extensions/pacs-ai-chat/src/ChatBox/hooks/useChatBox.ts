import { useState, useCallback, useEffect, useRef } from 'react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import type { ChatThreadSummary } from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import type { ChatActivity, ChatCitation, Message, ModalityData } from '../types';
import type { ChatFeedbackEntry } from './useChatFeedback';
import { chatResponseLanguage } from '@pacs-ai/extension-core/src/service/appLanguage';
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
  // Answer language from the chat backend (message.metadata); absent with an older backend.
  response_language?: 'en' | 'fr';
  response_language_source?: string;
  // True when the chat moved on (New chat, another thread, the chat box closed
  // for good) while this answer was running: the answer stays stored in its own
  // thread and must not be shown in the current chat.
  superseded?: boolean;
}

// Creating a thread is retried with exponential backoff and jitter while the
// chat backend is down or restarting (5xx, 409, 429, network error): 1 s, 2 s,
// 4 s, 8 s ... capped at 30 s, at most THREAD_CREATE_MAX_ATTEMPTS requests.
// Then the chat shows "unavailable" with a Retry button. Before this, a failed
// creation was retried immediately and the viewer sent ~230 requests a minute
// to a restarting medical-agent.
export const THREAD_CREATE_MAX_ATTEMPTS = 5;
export const THREAD_RETRY_BASE_MS = 1000;
export const THREAD_RETRY_MAX_MS = 30000;
export const CHAT_UNAVAILABLE_MESSAGE = 'The chat is unavailable right now. Please retry.';

/** Delay before retry number `attempt` (0 = first retry): exponential, capped, 50-100 % jitter. */
export function threadRetryDelay(attempt: number, random: () => number = Math.random): number {
  const capped = Math.min(THREAD_RETRY_MAX_MS, THREAD_RETRY_BASE_MS * 2 ** Math.max(0, attempt));
  return Math.round(capped * (0.5 + 0.5 * random()));
}

function errorStatus(error: any): number | undefined {
  const status = error?.status ?? error?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Server errors, conflicts, rate limits and network errors are retried; other 4xx are not. */
export function isRetryableThreadError(error: any): boolean {
  const status = errorStatus(error);
  if (status === undefined) {
    return true; // no HTTP answer: network error, proxy restarting
  }
  return status >= 500 || status === 409 || status === 429;
}

/** Error code of the gateway when the thread is still writing its previous answer. */
export const CHAT_TURN_IN_PROGRESS = 'chat_turn_in_progress';

// The thread the user last created, opened or wrote in, per study: restored
// first when the chat box opens again, even when it has no message yet.
const LAST_THREAD_KEY = 'pacsAiChat.lastThread.';

export function rememberLastThread(studyInstanceUID: string | undefined, threadId: string) {
  if (!studyInstanceUID) {
    return;
  }
  try {
    window.localStorage.setItem(LAST_THREAD_KEY + studyInstanceUID, threadId);
  } catch {
    // Storage blocked: the latest thread of the study is restored instead.
  }
}

export function lastThreadOf(studyInstanceUID: string | undefined): string | null {
  if (!studyInstanceUID) {
    return null;
  }
  try {
    return window.localStorage.getItem(LAST_THREAD_KEY + studyInstanceUID);
  } catch {
    return null;
  }
}

/** The answer language the chat backend reports in message.metadata, if any. */
function toResponseLanguage(
  metadata: { response_language?: unknown; response_language_source?: unknown } | undefined
): Pick<SendMessageResponse, 'response_language' | 'response_language_source'> {
  const language = metadata?.response_language;
  if (language !== 'en' && language !== 'fr') {
    return {};
  }
  const source = metadata?.response_language_source;
  return {
    response_language: language,
    ...(typeof source === 'string' ? { response_language_source: source } : {}),
  };
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
  // Thread creation failed for good (retries exhausted or a non-retryable
  // error): the chat shows the error with a Retry button and sends nothing.
  threadUnavailable: boolean;
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
  // True while the list of earlier threads is being loaded.
  threadsLoading: boolean;
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
  const [threadUnavailable, setThreadUnavailable] = useState(false);
  // Failed thread creations in a row, and the timer of the next retry.
  const threadAttempts = useRef(0);
  const threadRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearThreadRetry = useCallback(() => {
    if (threadRetryTimer.current !== null) {
      clearTimeout(threadRetryTimer.current);
      threadRetryTimer.current = null;
    }
  }, []);
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
  // Bumped by every chat action (restore, open, New chat): late results of older ones are ignored.
  const chatSeq = useRef(0);
  const listSeq = useRef(0);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const threadIdRef = useRef<string | null>(null);
  // Bumped by every message sent and by every chat change (New chat, a thread
  // opened): the answer of an older message no longer updates the chat box.
  const turnSeq = useRef(0);

  // The message in flight (if any) no longer belongs to the chat on screen: it
  // finishes into its own thread, and the input is free for the new chat.
  const releaseTurn = useCallback(() => {
    turnSeq.current += 1;
    if (progressTimer.current !== null) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(null);
    setIsProcessing(false);
    setIsLoading(false);
  }, []);

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
      clearThreadRetry();
    };
  }, [stopProgressPolling, clearThreadRetry]);

  // Creates a new thread, without the pending guard (the initializer sets it first).
  // A creation superseded by a newer chat action (New chat, a thread opened) is dropped.
  const startThread = useCallback(async (token: number) => {
    const current = () => isMounted.current && token === chatSeq.current;
    // A failed creation: retried later (the pending flag stays set until the
    // retry is due, so the initializer does not fire again at once), or, once
    // the attempts are used up or for a non-retryable error, the chat is shown
    // as unavailable until the user presses Retry.
    const failThread = (message: string, retryable: boolean) => {
      threadAttempts.current += 1;
      clearThreadRetry();
      if (retryable && threadAttempts.current < THREAD_CREATE_MAX_ATTEMPTS) {
        const delay = threadRetryDelay(threadAttempts.current - 1);
        console.log(
          `Chat thread creation failed (attempt ${threadAttempts.current}/${THREAD_CREATE_MAX_ATTEMPTS}), retrying in ${delay} ms`
        );
        setErrorDetails('');
        threadRetryTimer.current = setTimeout(() => {
          threadRetryTimer.current = null;
          if (current()) {
            setThreadCreationPending(false);
          }
        }, delay);
        return;
      }
      setThreadUnavailable(true);
      setErrorDetails(
        retryable ? `${CHAT_UNAVAILABLE_MESSAGE} (${message})` : message
      );
      setThreadCreationPending(false);
    };
    try {
      setThreadCreationPending(true);
      setIsLoading(true);
      setErrorDetails('');
      console.log('Creating thread...');

      const openStudy = getOpenStudy?.() ?? null;
      const metadata = openStudyMetadata(openStudy);
      const response = await orchestratorRepository.CreateThread(metadata ? { metadata } : {});

      if (!current()) {
        return;
      }
      if (response.success && response.data) {
        const newThreadId = response.data.thread_id;

        if (newThreadId) {
          console.log('Thread created with ID:', newThreadId);
          await attachOpenStudy(newThreadId, openStudy);
          if (!current()) {
            return;
          }
          threadAttempts.current = 0;
          setThreadUnavailable(false);
          setThreadId(newThreadId);
          rememberLastThread(openStudy?.studyInstanceUID, newThreadId);
          setErrorDetails('');
        } else {
          console.error('Thread ID not found in response:', response);
          failThread('Thread ID not found in server response', false);
        }
      } else {
        console.error('Invalid response format:', response);
        failThread(response.message || 'Invalid response format from server', false);
      }
    } catch (error: any) {
      console.error('Error creating thread:', error);
      if (!current()) {
        return;
      }

      let errorMessage = 'Unknown error occurred while creating thread';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.statusText) {
        errorMessage = `HTTP Error: ${error.response.statusText}`;
      } else if (errorStatus(error) !== undefined) {
        errorMessage = `HTTP ${errorStatus(error)}`;
      }

      failThread(errorMessage, isRetryableThreadError(error));
    } finally {
      // Keep the spinner while a retry is scheduled.
      if (current() && threadRetryTimer.current === null) {
        setIsLoading(false);
      }
    }
  }, [getOpenStudy, clearThreadRetry]);

  // Function to create a new thread
  const createThread = useCallback(async () => {
    if (threadCreationPending) return;
    await startThread(++chatSeq.current);
  }, [threadCreationPending, startThread]);

  // The signed-in user's earlier threads about the open study (none without a study).
  // Only the latest of overlapping refreshes updates the list.
  const refreshThreads = useCallback(async (): Promise<ChatThreadSummary[] | null> => {
    const studyInstanceUID = getOpenStudy?.()?.studyInstanceUID;
    if (!studyInstanceUID || typeof orchestratorRepository.ListChatThreads !== 'function') {
      return null;
    }
    const token = ++listSeq.current;
    setThreadsLoading(true);
    try {
      const response = await orchestratorRepository.ListChatThreads({
        studyInstanceUID,
        limit: CHAT_HISTORY_LIMIT,
      });
      const list =
        response?.success && Array.isArray(response.data?.threads) ? response.data.threads : [];
      if (isMounted.current && token === listSeq.current) {
        setThreads(list);
      }
      return list;
    } catch (error) {
      // An older gateway or chat service: no history, chat works as before.
      console.warn('Could not load the earlier chats of this study.');
      return null;
    } finally {
      if (isMounted.current && token === listSeq.current) {
        setThreadsLoading(false);
      }
    }
  }, [getOpenStudy]);

  // Loads a stored thread and, unless a newer chat action (New chat, another
  // thread) superseded it meanwhile, replaces the chat box content with it.
  const loadThread = useCallback(async (storedThreadId: string, token: number): Promise<boolean> => {
    if (!onRestoreRef.current) {
      return false;
    }
    setHistoryLoading(true);
    try {
      const response = await orchestratorRepository.GetChatThreadHistory({
        threadId: storedThreadId,
      });
      if (!response?.success || !response.data || !isMounted.current || token !== chatSeq.current) {
        return false;
      }
      onRestoreRef.current?.({
        messages: historyToMessages(response.data),
        feedback: historyToFeedback(response.data),
      });
      setErrorDetails('');
      setIsLoading(false);
      setThreadId(storedThreadId);
      return true;
    } catch (error) {
      console.warn('Could not open the earlier chat.');
      return false;
    } finally {
      if (isMounted.current && token === chatSeq.current) {
        setHistoryLoading(false);
      }
    }
  }, []);

  // Opens a stored thread picked in the history. If it cannot be opened while no
  // thread is active, thread creation starts again (the attempt superseded it).
  const openThread = useCallback(
    async (storedThreadId: string) => {
      const token = ++chatSeq.current;
      const opened = await loadThread(storedThreadId, token);
      if (opened) {
        releaseTurn();
        rememberLastThread(getOpenStudy?.()?.studyInstanceUID, storedThreadId);
      }
      if (!opened && isMounted.current && token === chatSeq.current && !threadIdRef.current) {
        setIsLoading(false);
        setThreadCreationPending(false);
      }
      return opened;
    },
    [loadThread, releaseTurn, getOpenStudy]
  );

  // Function to send a message to the backend
  const sendMessage = useCallback(
    async (
      currentThreadId: string,
      message: string,
      selectedSeries: string[],
      studyContext?: Record<string, string>
    ): Promise<SendMessageResponse> => {
      const turn = ++turnSeq.current;
      // Still the chat on screen: not replaced by New chat or another thread, not unmounted.
      const current = () => isMounted.current && turn === turnSeq.current;
      rememberLastThread(getOpenStudy?.()?.studyInstanceUID, currentThreadId);
      try {
        setIsLoading(true);
        setIsProcessing(true);
        setProgress(null);
        startProgressPolling(currentThreadId);

        // The app language (top bar) is the default for an unmarked question; the
        // backend still answers a question in the language it is written in.
        const responseLanguage = chatResponseLanguage();
        const response = await orchestratorRepository.CreateMessage({
          threadId: currentThreadId,
          message,
          metadata: {
            selectedSeries: selectedSeries,
            ...(studyContext || openStudyMetadata(getOpenStudy?.() ?? null) || {}),
            ...(responseLanguage ? { response_language: responseLanguage } : {}),
          },
        });

        if (!current()) {
          return { content: '', role: 'assistant', thread_id: currentThreadId, superseded: true };
        }
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
            ...toResponseLanguage(responseData.message?.metadata),
          };
        } else {
          throw new Error(response.message || 'Failed to send message');
        }
      } catch (error) {
        if (!current()) {
          return { content: '', role: 'assistant', thread_id: currentThreadId, superseded: true };
        }
        throw error;
      } finally {
        // An older message ending must not stop the polling or free the input of the current one.
        if (current()) {
          stopProgressPolling();
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
    if (!isOpen || threadId || threadCreationPending || threadUnavailable) {
      return;
    }
    const restore = !restoreTried.current && !!onRestoreRef.current;
    if (!restore && messagesLength > 0) {
      return;
    }
    restoreTried.current = true;
    setThreadCreationPending(true);
    const token = ++chatSeq.current;
    (async () => {
      if (restore) {
        setIsLoading(true);
        const list = await refreshThreads();
        // The thread the user last created, opened or wrote in (kept even with no
        // message yet, e.g. right after New chat); else the latest one with messages.
        const last = lastThreadOf(getOpenStudy?.()?.studyInstanceUID);
        let restored =
          !!last && token === chatSeq.current ? await loadThread(last, token) : false;
        if (!restored && token === chatSeq.current && list && list.length > 0) {
          restored = await loadThread(list[0].thread_id, token);
        }
        if (isMounted.current) {
          setIsLoading(false);
        }
        // Restored, unmounted, or superseded (New chat / another thread picked meanwhile).
        if (restored || !isMounted.current || token !== chatSeq.current) {
          return;
        }
        if (messagesLength > 0) {
          // Messages kept from before a remount belong to a thread that could not be
          // restored: clear them so the new thread does not look like their continuation.
          onRestoreRef.current?.({ messages: [], feedback: {} });
        }
      }
      await startThread(token);
    })();
  }, [isOpen, threadId, messagesLength, threadCreationPending, threadUnavailable, refreshThreads, loadThread, startThread, getOpenStudy]);

  threadIdRef.current = threadId;

  // Reset thread creation pending when threadId is set
  useEffect(() => {
    if (threadId) {
      setThreadCreationPending(false);
    }
  }, [threadId]);

  // Retry button: a fresh series of attempts.
  const handleRetryThreadCreation = useCallback(() => {
    clearThreadRetry();
    threadAttempts.current = 0;
    setThreadUnavailable(false);
    setErrorDetails('');
    setThreadCreationPending(false);
    setThreadId(null);
    createThread();
  }, [createThread, clearThreadRetry]);

  // New chat: supersedes a restore or an open still in flight, then a new thread is created.
  // A message still running stays in its own thread (stored there, listed in the
  // history); its answer is not shown in the new chat and does not block its input.
  const resetThread = useCallback(() => {
    chatSeq.current += 1;
    releaseTurn();
    clearThreadRetry();
    threadAttempts.current = 0;
    setThreadUnavailable(false);
    restoreTried.current = true;
    setHistoryLoading(false);
    setThreadId(null);
    setThreadCreationPending(false);
  }, [releaseTurn, clearThreadRetry]);

  return {
    threadId,
    isLoading,
    isProcessing,
    errorDetails,
    thinkingMessageId,
    progress,
    threadCreationPending,
    threadUnavailable,
    createThread,
    sendMessage,
    uploadDicomPayload,
    setErrorDetails,
    handleRetryThreadCreation,
    resetThread,
    threads,
    historyLoading,
    threadsLoading,
    refreshThreads,
    openThread,
  };
}
