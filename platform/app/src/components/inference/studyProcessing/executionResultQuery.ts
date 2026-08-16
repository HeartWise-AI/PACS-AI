import {
  createModelExecutionResultClient,
  ModelExecutionResultAbortedError,
  ModelExecutionResultClientError,
  type ModelExecutionResultClient,
} from './executionResultClient';
import type {
  ModelExecutionResult,
  ModelExecutionResultFailure,
  ModelExecutionStatus,
} from './types';

export interface ModelExecutionResultSelection {
  studyInstanceUID: string;
  runId: string;
  executionId: string;
  modelName: string;
  modelVersion: string | null;
  status: ModelExecutionStatus;
}

export type ModelExecutionResultQueryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelExecutionResultQueryState {
  key: string | null;
  selection: ModelExecutionResultSelection | null;
  status: ModelExecutionResultQueryStatus;
  result: ModelExecutionResult | null;
  failure: ModelExecutionResultFailure | null;
}

export const initialModelExecutionResultQueryState: ModelExecutionResultQueryState = {
  key: null,
  selection: null,
  status: 'idle',
  result: null,
  failure: null,
};

export function modelExecutionResultQueryKey(runId: string, executionId: string): string {
  return JSON.stringify([runId.trim(), executionId.trim()]);
}

function normalizedSelection(
  selection: ModelExecutionResultSelection
): ModelExecutionResultSelection | null {
  const normalized = {
    ...selection,
    studyInstanceUID: selection.studyInstanceUID.trim(),
    runId: selection.runId.trim(),
    executionId: selection.executionId.trim(),
    modelName: selection.modelName.trim(),
    modelVersion: selection.modelVersion?.trim() || null,
  };

  return normalized.studyInstanceUID &&
    normalized.runId &&
    normalized.executionId &&
    normalized.modelName
    ? normalized
    : null;
}

function invalidSelectionFailure(): ModelExecutionResultFailure {
  return {
    kind: 'unknown',
    status: 400,
    errorCode: 'INVALID_PAYLOAD',
    retryable: false,
    message: 'The model result request was invalid.',
  };
}

function notAvailableFailure(): ModelExecutionResultFailure {
  return {
    kind: 'not_available',
    status: 409,
    errorCode: 'INFERENCE_EXECUTION_RESULT_NOT_AVAILABLE',
    retryable: false,
    message: 'This model execution does not have a viewable completed result.',
  };
}

function invalidCorrelationFailure(): ModelExecutionResultFailure {
  return {
    kind: 'invalid_result',
    status: null,
    errorCode: null,
    retryable: false,
    message: 'The completed model result is unavailable.',
  };
}

function safeUnknownFailure(): ModelExecutionResultFailure {
  return {
    kind: 'service_unavailable',
    status: null,
    errorCode: null,
    retryable: true,
    message: 'Model results are temporarily unavailable.',
  };
}

function resultMatchesSelection(
  result: ModelExecutionResult,
  selection: ModelExecutionResultSelection
): boolean {
  return (
    result.runId === selection.runId &&
    result.executionId === selection.executionId &&
    result.studyInstanceUID === selection.studyInstanceUID &&
    result.modelName === selection.modelName &&
    result.modelVersion === selection.modelVersion &&
    result.status === 'completed'
  );
}

type QueryListener = () => void;

// ModelExecutionResultQueryCoordinator owns only the currently selected result.
// It is intentionally independent from processing snapshots, SSE state,
// notifications, analytics, and persistent browser storage.
export class ModelExecutionResultQueryCoordinator {
  private state = initialModelExecutionResultQueryState;
  private generation = 0;
  private abortController: AbortController | null = null;
  private readonly listeners = new Set<QueryListener>();

  constructor(
    private readonly client: ModelExecutionResultClient = createModelExecutionResultClient()
  ) {}

  getSnapshot = (): ModelExecutionResultQueryState => this.state;

  subscribe = (listener: QueryListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async select(selection: ModelExecutionResultSelection): Promise<void> {
    const currentGeneration = this.invalidateActiveRequest();
    const normalized = normalizedSelection(selection);
    if (!normalized) {
      this.publishFailure(null, null, invalidSelectionFailure());
      return;
    }

    const key = modelExecutionResultQueryKey(normalized.runId, normalized.executionId);
    if (normalized.status !== 'completed') {
      this.publishFailure(key, normalized, notAvailableFailure());
      return;
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    this.publish({
      key,
      selection: normalized,
      status: 'loading',
      result: null,
      failure: null,
    });

    try {
      const result = await this.client.loadExecutionResult({
        runId: normalized.runId,
        executionId: normalized.executionId,
        signal: abortController.signal,
      });
      if (!this.isCurrent(currentGeneration, key, normalized)) {
        return;
      }
      if (!resultMatchesSelection(result, normalized)) {
        this.publishFailure(key, normalized, invalidCorrelationFailure());
        return;
      }

      this.abortController = null;
      this.publish({ key, selection: normalized, status: 'ready', result, failure: null });
    } catch (error: unknown) {
      if (
        error instanceof ModelExecutionResultAbortedError ||
        !this.isCurrent(currentGeneration, key, normalized)
      ) {
        return;
      }

      this.abortController = null;
      this.publishFailure(
        key,
        normalized,
        error instanceof ModelExecutionResultClientError ? error.failure : safeUnknownFailure()
      );
    }
  }

  async retry(): Promise<boolean> {
    const { selection, failure } = this.state;
    if (!selection || !failure?.retryable) {
      return false;
    }

    await this.select(selection);
    return true;
  }

  clear(): void {
    this.invalidateActiveRequest();
    this.publish(initialModelExecutionResultQueryState);
  }

  private invalidateActiveRequest(): number {
    this.generation += 1;
    this.abortController?.abort();
    this.abortController = null;
    return this.generation;
  }

  private isCurrent(
    generation: number,
    key: string,
    selection: ModelExecutionResultSelection
  ): boolean {
    return (
      this.generation === generation && this.state.key === key && this.state.selection === selection
    );
  }

  private publishFailure(
    key: string | null,
    selection: ModelExecutionResultSelection | null,
    failure: ModelExecutionResultFailure
  ): void {
    this.abortController = null;
    this.publish({ key, selection, status: 'error', result: null, failure });
  }

  private publish(state: ModelExecutionResultQueryState): void {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
}
