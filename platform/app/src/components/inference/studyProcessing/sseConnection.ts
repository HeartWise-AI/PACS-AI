import {
  streamStudyProcessingEvents,
  type StreamStudyProcessingEventsOptions,
} from './sseTransport';

export type StudyProcessingSSEStream = (
  options: StreamStudyProcessingEventsOptions
) => Promise<void>;

export interface CreateStudyProcessingSSEConnectionOptions
  extends Omit<StreamStudyProcessingEventsOptions, 'signal'> {
  createAbortController?: () => AbortController;
  streamEvents?: StudyProcessingSSEStream;
}

export interface StudyProcessingSSEConnection {
  start(): Promise<void>;
  stop(): void;
  isActive(): boolean;
}

export function createStudyProcessingSSEConnection(
  options: CreateStudyProcessingSSEConnectionOptions
): StudyProcessingSSEConnection {
  const {
    createAbortController = () => new AbortController(),
    streamEvents = streamStudyProcessingEvents,
    ...streamOptions
  } = options;
  let activeController: AbortController | null = null;
  let activePromise: Promise<void> | null = null;

  function start(): Promise<void> {
    if (activePromise) {
      return activePromise;
    }

    const controller = createAbortController();
    activeController = controller;

    let streamPromise: Promise<void>;
    try {
      streamPromise = streamEvents({
        ...streamOptions,
        signal: controller.signal,
      });
    } catch (error) {
      streamPromise = Promise.reject(error);
    }

    const connectionPromise = streamPromise
      .catch(error => {
        if (!controller.signal.aborted) {
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

  function stop() {
    const controller = activeController;
    if (!controller) {
      return;
    }

    activeController = null;
    activePromise = null;
    controller.abort();
  }

  function isActive(): boolean {
    return activeController !== null && !activeController.signal.aborted;
  }

  return { start, stop, isActive };
}
