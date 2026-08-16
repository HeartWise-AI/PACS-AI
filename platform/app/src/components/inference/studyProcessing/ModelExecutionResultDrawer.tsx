import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelExecutionResultQueryState } from './executionResultQuery';
import { GenericModelResult } from './GenericModelResult';

export interface ModelExecutionResultDrawerProps {
  state: ModelExecutionResultQueryState;
  onClose: () => void;
  onRetry: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModelExecutionResultDrawer({
  state,
  onClose,
  onRetry: _onRetry,
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

    const focusableElements = Array.from(
      drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
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
          {state.status === 'ready' && <GenericModelResult value={state.result?.result} />}
          {state.status === 'error' && (
            <p
              role="alert"
              className="text-sm text-[#ffb0b0]"
            >
              {t('ProcessingModelResultLoadError', {
                defaultValue: 'The model result could not be displayed.',
              })}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

export default ModelExecutionResultDrawer;
