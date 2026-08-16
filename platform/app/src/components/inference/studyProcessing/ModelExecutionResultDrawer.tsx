import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelExecutionResultQueryState } from './executionResultQuery';
import { GenericModelResult } from './GenericModelResult';
import {
  getModelExecutionResultFailurePresentation,
  isEmptyModelExecutionResult,
} from './modelExecutionResultPresentation';

export interface ModelExecutionResultDrawerProps {
  state: ModelExecutionResultQueryState;
  onClose: () => void;
  onRetry: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), summary, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isVisibleInsideClosedDetails(element: HTMLElement, drawer: HTMLElement): boolean {
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== drawer) {
    if (
      ancestor.tagName === 'DETAILS' &&
      !ancestor.hasAttribute('open') &&
      ancestor.firstElementChild !== element
    ) {
      return false;
    }
    ancestor = ancestor.parentElement;
  }
  return true;
}

export function getModelResultDrawerFocusableElements(drawer: HTMLElement): HTMLElement[] {
  return Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(element =>
    isVisibleInsideClosedDetails(element, drawer)
  );
}

export function ModelExecutionResultDrawer({
  state,
  onClose,
  onRetry,
}: ModelExecutionResultDrawerProps) {
  const { t } = useTranslation('StudyList');
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const selection = state.selection;

  useEffect(() => {
    if (selection) {
      closeButtonRef.current?.focus();
    }
  }, [state.key, selection]);

  if (!selection) {
    return null;
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !drawerRef.current) {
      return;
    }

    const focusableElements = getModelResultDrawerFocusableElements(drawerRef.current);
    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const completedAt = state.result?.completedAt ?? null;
  const failurePresentation = getModelExecutionResultFailurePresentation(state.failure);
  const emptyResult = state.status === 'ready' && isEmptyModelExecutionResult(state.result?.result);

  return (
    <div
      className="fixed inset-0 z-[99999] flex bg-black/70"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      data-testid="model-execution-result-overlay"
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-execution-result-title"
        aria-describedby="model-execution-result-context"
        className="border-white/15 ml-auto flex h-full w-full max-w-2xl flex-col border-l bg-[#151815] text-white shadow-2xl"
        onKeyDown={handleKeyDown}
        data-testid="model-execution-result-drawer"
      >
        <header className="flex items-start gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0 grow">
            <h2
              id="model-execution-result-title"
              className="text-xl font-bold"
            >
              {t('ProcessingModelResultTitle', { defaultValue: 'Model result' })}
            </h2>
            <p
              id="model-execution-result-context"
              className="mt-2 text-sm text-[#c5cbc5]"
            >
              <span className="font-semibold text-white">{selection.modelName}</span>
              {selection.modelVersion && ` · v${selection.modelVersion}`}
              {completedAt && ` · ${new Date(completedAt).toLocaleString()}`}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#78b7f5]"
            onClick={onClose}
            aria-label={t('ProcessingModelResultClose', { defaultValue: 'Close model result' })}
            data-testid="model-execution-result-close"
          >
            {t('Close', { defaultValue: 'Close' })}
          </button>
        </header>

        <div className="ohif-scrollbar min-h-0 grow overflow-y-auto px-6 py-5">
          {state.status === 'loading' && (
            <div
              role="status"
              aria-live="polite"
              data-testid="model-execution-result-loading"
            >
              <p className="text-sm font-semibold text-[#c5cbc5]">
                {t('ProcessingModelResultLoading', { defaultValue: 'Loading model result…' })}
              </p>
              <div
                className="mt-5 space-y-3"
                aria-hidden="true"
              >
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-white/10" />
              </div>
            </div>
          )}
          {state.status === 'ready' && !emptyResult && (
            <GenericModelResult value={state.result?.result} />
          )}
          {emptyResult && (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-[#c5cbc5]"
              role="status"
              data-testid="model-execution-result-empty"
            >
              {t('ProcessingModelResultEmpty', {
                defaultValue: 'This completed model result contains no fields to display.',
              })}
            </div>
          )}
          {state.status === 'error' && (
            <div
              role="alert"
              className="border-[#f87171]/35 rounded-lg border bg-[#482828] px-5 py-4 text-sm text-[#ffb0b0]"
              data-testid={`model-execution-result-error-${state.failure?.kind ?? 'unknown'}`}
            >
              <p>
                {t(failurePresentation.key, {
                  defaultValue: failurePresentation.defaultValue,
                })}
              </p>
              {state.failure?.retryable && (
                <button
                  type="button"
                  className="mt-4 rounded-md border border-current px-4 py-2 text-xs font-bold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#ffb0b0]"
                  onClick={onRetry}
                  data-testid="model-execution-result-retry"
                >
                  {t('ProcessingModelResultRetry', { defaultValue: 'Try again' })}
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default ModelExecutionResultDrawer;
