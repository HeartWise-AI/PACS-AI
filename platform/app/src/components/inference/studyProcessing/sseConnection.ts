import {
  streamStudyProcessingEvents,
  StudyProcessingSSEError,
  type StreamStudyProcessingEventsOptions,
} from './sseTransport';
import type { RealtimeConnectionStatus } from './reducer';

export type StudyProcessingSSEStream = (
  options: StreamStudyProcessingEventsOptions
) => Promise<void>;

export interface CreateStudyProcessingSSEConnectionOptions
  extends Omit<StreamStudyProcessingEventsOptions, 'signal'> {
  createAbortController?: () => AbortController;
  streamEvents?: StudyProcessingSSEStream;
  onStateChange?(status: RealtimeConnectionStatus, error: string | null): void;
}

export interface StudyProcessingSSEConnection {
  start(): Promise<void>;
  reconnect(error?: string | null): Promise<void>;
  stop(): void;
  isActive(): boolean;
}

function safeConnectionErrorMessage(error: unknown): string {
  return error instanceof StudyProcessingSSEError
    ? error.message
    : 'Live processing connection was interrupted.';
}

export function createStudyProcessingSSEConnection(
  options: CreateStudyProcessingSSEConnectionOptions
): StudyProcessingSSEConnection {
  const {
    createAbortController = () => new AbortController(),
    streamEvents = streamStudyProcessingEvents,
    onOpen,
    onStateChange,
    ...streamOptions
  } = options;
  let activeController: AbortController | null = null;
  let activePromise: Promise<void> | null = null;
  let currentStatus: RealtimeConnectionStatus = 'disconnected';
  let currentError: string | null = null;

  function setState(status: RealtimeConnectionStatus, error: string | null = null) {
    if (currentStatus === status && currentError === error) {
      return;
    }

    currentStatus = status;
    currentError = error;
    onStateChange?.(status, error);
  }

  function begin(
    pendingStatus: 'connecting' | 'reconnecting',
    pendingError: string | null
  ): Promise<void> {
    if (activePromise) {
      return activePromise;
    }

    const controller = createAbortController();
    activeController = controller;
    setState(pendingStatus, pendingError);

    let streamPromise: Promise<void>;
    try {
      streamPromise = streamEvents({
        ...streamOptions,
        signal: controller.signal,
        onOpen: () => {
          onOpen?.();
          if (activeController === controller && !controller.signal.aborted) {
            setState('connected');
          }
        },
      });
    } catch (error) {
      streamPromise = Promise.reject(error);
    }

    const connectionPromise = streamPromise
      .then(() => {
        if (activeController === controller && !controller.signal.aborted) {
          setState('disconnected');
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setState('degraded', safeConnectionErrorMessage(error));
          throw error;
        }
      })
      .finally(() => {
        if (activeController === controller) {
          activeController = null;
          activePromise = null;
        }
      });

    activePromise = connectionPromise;
    return connectionPromise;
  }

  function start(): Promise<void> {
    return begin('connecting', null);
  }

  function reconnect(error: string | null = null): Promise<void> {
    return begin('reconnecting', error);
  }

  function stop() {
    const controller = activeController;
    if (!controller) {
      setState('disconnected');
      return;
    }

    activeController = null;
    activePromise = null;
    controller.abort();
    setState('disconnected');
  }

  function isActive(): boolean {
    return activeController !== null && !activeController.signal.aborted;
  }

  return { start, reconnect, stop, isActive };
}
