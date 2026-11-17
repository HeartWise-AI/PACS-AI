import type { StudyProcessingSSEConnection } from './sseConnection';
import { StudyProcessingSSEError } from './sseTransport';

export const DEFAULT_SSE_RECONNECT_INITIAL_DELAY_MS = 1000;
export const DEFAULT_SSE_RECONNECT_MAX_DELAY_MS = 30000;
export const DEFAULT_SSE_RECONNECT_MULTIPLIER = 2;
export const DEFAULT_SSE_RECONNECT_JITTER_RATIO = 0.2;

export interface StudyProcessingSSEBackoffPolicy {
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitterRatio?: number;
}

export type StudyProcessingSSESleep = (delayMs: number, signal: AbortSignal) => Promise<void>;

export interface CreateStudyProcessingSSEReconnectControllerOptions {
  connection: StudyProcessingSSEConnection;
  backoff?: StudyProcessingSSEBackoffPolicy;
  random?: () => number;
  sleep?: StudyProcessingSSESleep;
  onRetryScheduled?(attempt: number, delayMs: number): void;
}

export interface StudyProcessingSSEReconnectController {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
}

export function shouldRetryStudyProcessingSSE(error: unknown): boolean {
  if (error instanceof StudyProcessingSSEError) {
    return error.status === 503;
  }

  return true;
}

function retryErrorMessage(error: unknown): string {
  return error instanceof StudyProcessingSSEError
    ? error.message
    : 'Live processing connection was interrupted.';
}

export function calculateStudyProcessingSSEReconnectDelay(
  attempt: number,
  policy: StudyProcessingSSEBackoffPolicy = {},
  random: () => number = Math.random
): number {
  const initialDelayMs = Math.max(
    0,
    policy.initialDelayMs ?? DEFAULT_SSE_RECONNECT_INITIAL_DELAY_MS
  );
  const maxDelayMs = Math.max(
    initialDelayMs,
    policy.maxDelayMs ?? DEFAULT_SSE_RECONNECT_MAX_DELAY_MS
  );
  const multiplier = Math.max(1, policy.multiplier ?? DEFAULT_SSE_RECONNECT_MULTIPLIER);
  const jitterRatio = Math.min(
    1,
    Math.max(0, policy.jitterRatio ?? DEFAULT_SSE_RECONNECT_JITTER_RATIO)
  );
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  const exponentialDelay = Math.min(
    maxDelayMs,
    initialDelayMs * multiplier ** (normalizedAttempt - 1)
  );
  const jitterRange = exponentialDelay * jitterRatio;
  const normalizedRandom = Math.min(1, Math.max(0, random()));
  const jitteredDelay = exponentialDelay - jitterRange + normalizedRandom * jitterRange * 2;

  return Math.round(Math.min(maxDelayMs, Math.max(0, jitteredDelay)));
}

const defaultSleep: StudyProcessingSSESleep = (delayMs, signal) =>
  new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timeout = setTimeout(finish, delayMs);
    signal.addEventListener('abort', finish, { once: true });
  });

export function createStudyProcessingSSEReconnectController(
  options: CreateStudyProcessingSSEReconnectControllerOptions
): StudyProcessingSSEReconnectController {
  const {
    connection,
    backoff,
    random = Math.random,
    sleep = defaultSleep,
    onRetryScheduled,
  } = options;
  let activeController: AbortController | null = null;
  let activePromise: Promise<void> | null = null;

  async function run(controller: AbortController): Promise<void> {
    let retryAttempt = 0;
    let reconnecting = false;
    let previousError: unknown = null;

    while (!controller.signal.aborted) {
      try {
        if (reconnecting) {
          await connection.reconnect(retryErrorMessage(previousError));
        } else {
          await connection.start();
        }

        if (controller.signal.aborted) {
          return;
        }

        previousError = new Error('The live processing stream closed.');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (!shouldRetryStudyProcessingSSE(error)) {
          throw error;
        }
        previousError = error;
      }

      retryAttempt += 1;
      const delayMs = calculateStudyProcessingSSEReconnectDelay(retryAttempt, backoff, random);
      onRetryScheduled?.(retryAttempt, delayMs);
      await sleep(delayMs, controller.signal);
      reconnecting = true;
    }
  }

  function start(): Promise<void> {
    if (activePromise) {
      return activePromise;
    }

    const controller = new AbortController();
    activeController = controller;
    const runPromise = run(controller).finally(() => {
      if (activeController === controller) {
        activeController = null;
        activePromise = null;
      }
    });
    activePromise = runPromise;
    return runPromise;
  }

  function stop() {
    const controller = activeController;
    activeController = null;
    activePromise = null;
    controller?.abort();
    connection.stop();
  }

  function isRunning(): boolean {
    return activeController !== null && !activeController.signal.aborted;
  }

  return { start, stop, isRunning };
}
