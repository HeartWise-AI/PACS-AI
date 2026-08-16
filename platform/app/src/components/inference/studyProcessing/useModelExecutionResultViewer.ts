import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  ModelExecutionResultQueryCoordinator,
  type ModelExecutionResultQueryState,
  type ModelExecutionResultSelection,
} from './executionResultQuery';

export interface ModelExecutionResultViewerController {
  state: ModelExecutionResultQueryState;
  open: (selection: ModelExecutionResultSelection, trigger?: HTMLElement | null) => void;
  close: () => void;
  retry: () => void;
}

export function useModelExecutionResultViewer(
  resetKey: string | null,
  providedCoordinator?: ModelExecutionResultQueryCoordinator
): ModelExecutionResultViewerController {
  const ownedCoordinatorRef = useRef<ModelExecutionResultQueryCoordinator | null>(null);
  if (!ownedCoordinatorRef.current) {
    ownedCoordinatorRef.current = providedCoordinator ?? new ModelExecutionResultQueryCoordinator();
  }

  const coordinator = ownedCoordinatorRef.current;
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const previousResetKeyRef = useRef(resetKey);
  const state = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot
  );

  const open = useCallback(
    (selection: ModelExecutionResultSelection, trigger?: HTMLElement | null) => {
      if (trigger) {
        returnFocusRef.current = trigger;
      } else if (
        typeof HTMLElement !== 'undefined' &&
        document.activeElement instanceof HTMLElement
      ) {
        returnFocusRef.current = document.activeElement;
      }
      void coordinator.select(selection);
    },
    [coordinator]
  );

  const close = useCallback(() => {
    coordinator.clear();
    const returnFocus = returnFocusRef.current;
    returnFocusRef.current = null;
    returnFocus?.focus();
  }, [coordinator]);

  const retry = useCallback(() => {
    void coordinator.retry();
  }, [coordinator]);

  useEffect(() => {
    if (previousResetKeyRef.current !== resetKey) {
      coordinator.clear();
      returnFocusRef.current = null;
      previousResetKeyRef.current = resetKey;
    }
  }, [coordinator, resetKey]);

  useEffect(
    () => () => {
      coordinator.clear();
      returnFocusRef.current = null;
    },
    [coordinator]
  );

  return { state, open, close, retry };
}
