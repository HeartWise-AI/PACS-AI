import { useCallback, useRef, useState } from 'react';
import {
  createModelExecutionResultClient,
  type ModelExecutionResultClient,
} from '../../components/inference/studyProcessing/executionResultClient';
import { keyResultModel, summarizeKeyResult, type Translate } from './keyResults';
import type { PredictionExecution } from './types';

export type KeyResultState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; text: string | null }
  | { status: 'error' };

export interface ExecutionResults {
  /** The result payload of a completed execution, loaded once per page. */
  loadResult(execution: Pick<PredictionExecution, 'runId' | 'executionId'>): Promise<unknown>;
  keyResult(execution: PredictionExecution): KeyResultState;
  /** Starts loading the key result of a completed main-model execution. */
  requestKeyResult(execution: PredictionExecution): void;
}

export function useExecutionResults(
  t: Translate,
  client?: ModelExecutionResultClient
): ExecutionResults {
  const clientRef = useRef<ModelExecutionResultClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = client ?? createModelExecutionResultClient();
  }
  const resultsRef = useRef(new Map<string, Promise<unknown>>());
  const [keyResults, setKeyResults] = useState<Record<string, KeyResultState>>({});
  const requestedRef = useRef(new Set<string>());
  const tRef = useRef(t);
  tRef.current = t;

  const loadResult = useCallback(
    (execution: Pick<PredictionExecution, 'runId' | 'executionId'>) => {
      const key = `${execution.runId}/${execution.executionId}`;
      let pending = resultsRef.current.get(key);
      if (!pending) {
        pending = (clientRef.current as ModelExecutionResultClient)
          .loadExecutionResult({ runId: execution.runId, executionId: execution.executionId })
          .then(result => result.result);
        // A failure may be retried later.
        pending.catch(() => resultsRef.current.delete(key));
        resultsRef.current.set(key, pending);
      }
      return pending;
    },
    []
  );

  const keyResult = useCallback(
    (execution: PredictionExecution): KeyResultState => {
      if (execution.state !== 'completed' || !keyResultModel(execution.modelName)) {
        return { status: 'none' };
      }
      return keyResults[execution.executionId] ?? { status: 'loading' };
    },
    [keyResults]
  );

  const requestKeyResult = useCallback(
    (execution: PredictionExecution) => {
      if (
        execution.state !== 'completed' ||
        !keyResultModel(execution.modelName) ||
        requestedRef.current.has(execution.executionId)
      ) {
        return;
      }
      requestedRef.current.add(execution.executionId);
      loadResult(execution).then(
        result =>
          setKeyResults(current => ({
            ...current,
            [execution.executionId]: {
              status: 'ready',
              text: summarizeKeyResult(execution.modelName, result, tRef.current),
            },
          })),
        () => {
          requestedRef.current.delete(execution.executionId);
          setKeyResults(current => ({ ...current, [execution.executionId]: { status: 'error' } }));
        }
      );
    },
    [loadResult]
  );

  return { loadResult, keyResult, requestKeyResult };
}
