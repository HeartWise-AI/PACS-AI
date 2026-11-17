import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunningJobCancelState, RunningJobRow } from './types';

// 'ended': nothing of the run is left to compute. 'stillRunning': its waiting
// models were cancelled, but a model that was already computing finishes.
export type RunningJobCancelOutcome = 'ended' | 'stillRunning';

export type RunningJobCancelStates = Readonly<Record<string, RunningJobCancelState>>;

export interface UseRunningJobsCancelOptions {
  // Cancels the row's run. A rejection whose `status` is 409 means the run
  // started computing and can no longer be cancelled.
  cancel: (row: RunningJobRow) => Promise<RunningJobCancelOutcome>;
}

export interface RunningJobsCancel {
  states: RunningJobCancelStates;
  // Opens the inline confirmation of the row.
  request: (row: RunningJobRow) => void;
  // Leaves the confirmation without cancelling.
  abort: (row: RunningJobRow) => void;
  confirm: (row: RunningJobRow) => void;
}

function isConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { status?: unknown }).status === 409;
}

/** Inline cancellation of indicator rows: confirm, submit, report. */
export function useRunningJobsCancel({ cancel }: UseRunningJobsCancelOptions): RunningJobsCancel {
  const [states, setStates] = useState<RunningJobCancelStates>({});
  const statesRef = useRef(states);
  statesRef.current = states;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setRowState = useCallback((rowId: string, state: RunningJobCancelState | null) => {
    if (!mounted.current) {
      return;
    }
    setStates(current => {
      const { [rowId]: _previous, ...others } = current;
      void _previous;
      return state ? { ...others, [rowId]: state } : others;
    });
  }, []);

  const request = useCallback(
    (row: RunningJobRow) => {
      const phase = statesRef.current[row.id]?.phase;
      if (phase !== 'submitting' && phase !== 'cancelled') {
        setRowState(row.id, { phase: 'confirming' });
      }
    },
    [setRowState]
  );

  const abort = useCallback(
    (row: RunningJobRow) => {
      if (statesRef.current[row.id]?.phase === 'confirming') {
        setRowState(row.id, null);
      }
    },
    [setRowState]
  );

  const confirm = useCallback(
    (row: RunningJobRow) => {
      if (statesRef.current[row.id]?.phase !== 'confirming') {
        return;
      }
      setRowState(row.id, { phase: 'submitting' });
      cancel(row).then(
        outcome => {
          setRowState(row.id, outcome === 'ended' ? { phase: 'cancelled', at: Date.now() } : null);
        },
        (error: unknown) => {
          setRowState(row.id, { phase: 'error', error: isConflict(error) ? 'tooLate' : 'failed' });
        }
      );
    },
    [cancel, setRowState]
  );

  return { states, request, abort, confirm };
}

/**
 * Rows as the card shows them: a row whose cancellation was confirmed reads
 * "cancelled" at once, before the next poll reports how the run ended.
 */
export function applyRunningJobCancelStates(
  rows: RunningJobRow[],
  states: RunningJobCancelStates
): RunningJobRow[] {
  return rows.map(row => {
    const state = states[row.id];
    if (state?.phase !== 'cancelled') {
      return row;
    }
    const { waiting: _waiting, cancelRunId: _cancelRunId, ...rest } = row;
    void _waiting;
    void _cancelRunId;
    return {
      ...rest,
      state: 'cancelled',
      active: false,
      endedAt: row.endedAt ?? state.at ?? row.startedAt,
      runningModelNames: [],
    };
  });
}
