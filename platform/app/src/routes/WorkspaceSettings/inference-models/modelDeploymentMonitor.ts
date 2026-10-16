import type { InferenceModelDeploymentEvent } from '../../../api/inferenceDTO';
import inferenceRepository from '../../../api/inferenceRepository';
import { operationDeploymentProgress, type ModelDeploymentConnectionMode } from './modelDeployment';
import {
  streamModelDeploymentEvents,
  type StreamModelDeploymentEventsOptions,
} from './modelDeploymentSSE';

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_RECONNECT_INTERVAL_MS = 5000;

type Timer = ReturnType<typeof setTimeout>;

export interface ModelDeploymentMonitorDependencies {
  getOperation?: typeof inferenceRepository.GetInferenceModelDeploymentOperation;
  stream?: (options: StreamModelDeploymentEventsOptions) => Promise<void>;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  pollIntervalMs?: number;
  reconnectIntervalMs?: number;
}

export interface ModelDeploymentMonitorCallbacks {
  onProgress(event: InferenceModelDeploymentEvent): void;
  onConnectionMode(mode: ModelDeploymentConnectionMode): void;
  onTerminal(event: InferenceModelDeploymentEvent): void;
}

export interface ModelDeploymentMonitor {
  start(): void;
  stop(): void;
}

export function createModelDeploymentMonitor(
  modelId: string,
  deploymentId: string,
  callbacks: ModelDeploymentMonitorCallbacks,
  dependencies: ModelDeploymentMonitorDependencies = {}
): ModelDeploymentMonitor {
  const abortController = new AbortController();
  const getOperation =
    dependencies.getOperation ?? inferenceRepository.GetInferenceModelDeploymentOperation;
  const stream = dependencies.stream ?? streamModelDeploymentEvents;
  const setIntervalFn = dependencies.setInterval ?? globalThis.setInterval;
  const clearIntervalFn = dependencies.clearInterval ?? globalThis.clearInterval;
  const setTimeoutFn = dependencies.setTimeout ?? globalThis.setTimeout;
  const clearTimeoutFn = dependencies.clearTimeout ?? globalThis.clearTimeout;
  const pollIntervalMs = dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const reconnectIntervalMs = dependencies.reconnectIntervalMs ?? DEFAULT_RECONNECT_INTERVAL_MS;
  let pollTimer: Timer | undefined;
  let reconnectTimer: Timer | undefined;
  let stopped = false;
  let terminal = false;
  let lastSequence = 0;

  function stopPolling() {
    if (pollTimer) {
      clearIntervalFn(pollTimer);
      pollTimer = undefined;
    }
  }

  function stop() {
    if (stopped) {
      return;
    }
    stopped = true;
    abortController.abort();
    stopPolling();
    if (reconnectTimer) {
      clearTimeoutFn(reconnectTimer);
      reconnectTimer = undefined;
    }
  }

  function applyProgress(event: InferenceModelDeploymentEvent) {
    if (stopped || event.deploymentId !== deploymentId || event.sequence <= lastSequence) {
      return;
    }
    lastSequence = event.sequence;
    callbacks.onProgress(event);
    if (event.terminal) {
      terminal = true;
      callbacks.onTerminal(event);
      stop();
    }
  }

  function refreshSnapshot(): Promise<void> {
    if (stopped || terminal) {
      return Promise.resolve();
    }
    return getOperation(modelId, deploymentId)
      .then(response => {
        applyProgress(operationDeploymentProgress(response.data.deployment));
      })
      .catch(() => {
        // The live stream remains primary. A later poll or reconnect can recover.
      });
  }

  function beginFallback() {
    callbacks.onConnectionMode('polling');
    if (!pollTimer) {
      void refreshSnapshot();
      pollTimer = setIntervalFn(() => {
        void refreshSnapshot();
      }, pollIntervalMs);
    }
    if (!reconnectTimer) {
      reconnectTimer = setTimeoutFn(() => {
        reconnectTimer = undefined;
        void connect();
      }, reconnectIntervalMs);
    }
  }

  function connect(): Promise<void> {
    if (stopped || terminal) {
      return Promise.resolve();
    }
    return stream({
      modelId,
      deploymentId,
      lastEventId: lastSequence,
      signal: abortController.signal,
      onOpen: () => {
        if (stopped || terminal) {
          return;
        }
        stopPolling();
        callbacks.onConnectionMode('live');
      },
      onEvent: applyProgress,
    })
      .catch(() => {
        // Disconnections are expected during restarts and proxy timeouts.
      })
      .then(() => {
        if (!stopped && !terminal) {
          beginFallback();
        }
      });
  }

  function start() {
    if (stopped) {
      return;
    }
    callbacks.onConnectionMode('connecting');
    void refreshSnapshot();
    void connect();
  }

  return { start, stop };
}
