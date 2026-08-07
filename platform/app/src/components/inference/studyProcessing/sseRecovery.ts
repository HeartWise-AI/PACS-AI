import type {
  StudyProcessingSSEConnection,
  StudyProcessingSSEConnectionStateListener,
} from './sseConnection';
import { StudyProcessingRESTError } from './restRepository';

export interface CreateStudyProcessingSSERecoveryOptions {
  connection: StudyProcessingSSEConnection;
  refreshVisibleStudySnapshot(): Promise<void>;
  onRecoveryError?(message: string): void;
}

export interface StudyProcessingSSERecovery {
  start(): void;
  stop(): void;
  waitForIdle(): Promise<void>;
}

function safeRecoveryErrorMessage(error: unknown): string {
  return error instanceof StudyProcessingRESTError
    ? error.message
    : 'Unable to refresh visible processing status after reconnecting.';
}

export function createStudyProcessingSSERecovery(
  options: CreateStudyProcessingSSERecoveryOptions
): StudyProcessingSSERecovery {
  const { connection, refreshVisibleStudySnapshot, onRecoveryError } = options;
  let unsubscribe: (() => void) | null = null;
  let reconnectPending = false;
  let generation = 0;
  let refreshQueue = Promise.resolve();

  function scheduleRefresh(activeGeneration: number) {
    refreshQueue = refreshQueue.then(async () => {
      if (!unsubscribe || generation !== activeGeneration) {
        return;
      }

      try {
        await refreshVisibleStudySnapshot();
      } catch (error) {
        if (unsubscribe && generation === activeGeneration) {
          onRecoveryError?.(safeRecoveryErrorMessage(error));
        }
      }
    });
  }

  function start() {
    if (unsubscribe) {
      return;
    }

    const activeGeneration = ++generation;
    const listener: StudyProcessingSSEConnectionStateListener = status => {
      if (status === 'connecting') {
        reconnectPending = false;
        return;
      }

      if (status === 'reconnecting') {
        reconnectPending = true;
        return;
      }

      if (status === 'connected' && reconnectPending) {
        reconnectPending = false;
        scheduleRefresh(activeGeneration);
        return;
      }

      if (status === 'disconnected') {
        reconnectPending = false;
      }
    };

    unsubscribe = connection.subscribe(listener);
  }

  function stop() {
    generation += 1;
    reconnectPending = false;
    unsubscribe?.();
    unsubscribe = null;
  }

  function waitForIdle(): Promise<void> {
    return refreshQueue;
  }

  return { start, stop, waitForIdle };
}
