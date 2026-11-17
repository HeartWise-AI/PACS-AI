import { useCallback, useRef, useState } from 'react';
import type { RunningJobRow } from './types';

export const RUNNING_JOBS_COLLAPSED_STORAGE_KEY = 'pacsai.runningJobs.collapsed';

export function readRunningJobsCollapsed(): boolean {
  try {
    return window.localStorage.getItem(RUNNING_JOBS_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeRunningJobsCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(RUNNING_JOBS_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Storage can be unavailable (private mode, quota); the state then lasts
    // for the page only.
  }
}

/** Closed until a run that was not there when the card was closed shows up. */
export function isRunningJobsCardClosed(
  rows: Pick<RunningJobRow, 'id'>[],
  closedRowIds: string[] | null
): boolean {
  return closedRowIds !== null && rows.every(row => closedRowIds.includes(row.id));
}

export interface RunningJobsCardState {
  collapsed: boolean;
  closed: boolean;
  toggleCollapsed: () => void;
  close: () => void;
}

export function useRunningJobsCardState(rows: Pick<RunningJobRow, 'id'>[]): RunningJobsCardState {
  const [collapsed, setCollapsed] = useState(readRunningJobsCollapsed);
  const [closedRowIds, setClosedRowIds] = useState<string[] | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(current => {
      writeRunningJobsCollapsed(!current);
      return !current;
    });
  }, []);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const close = useCallback(() => {
    setClosedRowIds(rowsRef.current.map(row => row.id));
  }, []);

  return {
    collapsed,
    closed: isRunningJobsCardClosed(rows, closedRowIds),
    toggleCollapsed,
    close,
  };
}
