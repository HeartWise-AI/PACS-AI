import { useEffect, useState } from 'react';
import type { ModelExecutionResult } from '@pacs-ai/extension-core/src/studyProcessing/types';
import type { ViewerResultsRepository } from './viewerResultsRepository';
import type { ViewerModelResult } from './types';

export type StoredJobResultState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: ModelExecutionResult }
  // No such endpoint (older api-pacs), no access, or no stored result.
  | { status: 'unavailable' }
  | { status: 'error' };

// Loads the stored JSON of a study-service job (no api-pacs run) when
// `enabled`; idle otherwise.
export function useStoredJobResult(
  repository: ViewerResultsRepository,
  result: ViewerModelResult | null,
  enabled: boolean
): StoredJobResultState {
  const [state, setState] = useState<StoredJobResultState>({ status: 'idle' });
  const jobId = result?.studyServiceJobId ?? null;
  const studyInstanceUID = result?.studyInstanceUID ?? null;

  useEffect(() => {
    if (!enabled || !result || !jobId || !repository.loadJobResult) {
      setState(
        enabled && result && !repository.loadJobResult
          ? { status: 'unavailable' }
          : { status: 'idle' }
      );
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    repository.loadJobResult(result).then(
      loaded => {
        if (!cancelled) {
          setState({ status: 'ready', result: loaded });
        }
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? (error as { status: unknown }).status
            : null;
        setState(
          status === 403 || status === 404 || status === 405 || status === 501
            ? { status: 'unavailable' }
            : { status: 'error' }
        );
      }
    );
    return () => {
      cancelled = true;
    };
    // The job identifies what is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, enabled, jobId, studyInstanceUID]);

  return state;
}
