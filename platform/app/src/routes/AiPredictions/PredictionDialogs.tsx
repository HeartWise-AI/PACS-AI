import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compareResults, type ResultComparison } from './compareResults';
import type { PredictionExecution } from './types';

interface DialogShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  testId: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function DialogShell({ title, subtitle, onClose, children, testId }: DialogShellProps) {
  const { t } = useTranslation('AiPredictions');
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        className="border-white/15 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border bg-[#151815] text-[#E8ECE6] shadow-2xl"
        onKeyDown={handleKeyDown}
        data-testid={testId}
      >
        <header className="flex items-start gap-4 border-b border-white/10 px-6 py-4">
          <div className="min-w-0 grow">
            <h2
              id={`${testId}-title`}
              className="text-lg font-bold"
            >
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-[#C9D1C6]">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="min-h-[44px] rounded-md border border-white/20 px-4 text-sm font-semibold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#C8F469]"
            onClick={onClose}
          >
            {t('Close')}
          </button>
        </header>
        <div className="ohif-scrollbar min-h-0 grow overflow-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

type Loaded<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error' };

function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const loadRef = useRef(load);
  useEffect(() => {
    let cancelled = false;
    loadRef.current().then(
      value => !cancelled && setState({ status: 'ready', value }),
      () => !cancelled && setState({ status: 'error' })
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function describe(execution: PredictionExecution): string {
  const when = execution.completedAt ?? execution.runCreatedAt;
  const date = when ? new Date(when) : null;
  return [
    execution.modelName,
    execution.modelVersion ? `v${execution.modelVersion}` : null,
    date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch (error: unknown) {
    return String(value);
  }
}

const PRE_CLASS =
  'whitespace-pre-wrap break-words rounded-md border border-white/10 bg-[#101410] p-3 font-mono text-xs leading-5 text-[#E8ECE6]';

export function RawDataDialog({
  execution,
  loadResult,
  onClose,
}: {
  execution: PredictionExecution;
  loadResult: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation('AiPredictions');
  const state = useLoaded(loadResult);
  return (
    <DialogShell
      title={t('Raw data')}
      subtitle={describe(execution)}
      onClose={onClose}
      testId="ai-predictions-raw"
    >
      {state.status === 'loading' && <p role="status">{t('Loading the result…')}</p>}
      {state.status === 'error' && <p role="alert">{t('The result could not be loaded.')}</p>}
      {state.status === 'ready' && <pre className={PRE_CLASS}>{pretty(state.value)}</pre>}
    </DialogShell>
  );
}

export function ComparisonView({ comparison }: { comparison: ResultComparison }) {
  const { t } = useTranslation('AiPredictions');
  if (comparison.kind === 'raw') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label={t('Latest run')}>
          <h3 className="mb-2 text-sm font-semibold">{t('Latest run')}</h3>
          <pre className={PRE_CLASS}>{comparison.latest}</pre>
        </section>
        <section aria-label={t('Earlier run')}>
          <h3 className="mb-2 text-sm font-semibold">{t('Earlier run')}</h3>
          <pre className={PRE_CLASS}>{comparison.earlier}</pre>
        </section>
      </div>
    );
  }
  return (
    <>
      <p
        className="mb-3 text-sm text-[#C9D1C6]"
        role="status"
      >
        {comparison.changedCount === 0
          ? t('No value changed.')
          : comparison.changedCount === 1
            ? t('1 value changed.')
            : t('{{count}} values changed.', { count: comparison.changedCount })}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-[#A9B3A6]">
              <th
                scope="col"
                className="border-b border-[#2B332A] px-3 py-2"
              >
                {t('Field')}
              </th>
              <th
                scope="col"
                className="border-b border-[#2B332A] px-3 py-2"
              >
                {t('Latest run')}
              </th>
              <th
                scope="col"
                className="border-b border-[#2B332A] px-3 py-2"
              >
                {t('Earlier run')}
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map(row => (
              <tr
                key={row.key}
                className={row.changed ? 'bg-[#3A3320]' : undefined}
                data-changed={row.changed ? 'true' : 'false'}
              >
                <th
                  scope="row"
                  className="border-b border-[#222922] px-3 py-2 text-left font-medium"
                >
                  {row.key}
                  {row.changed && (
                    <span className="ml-2 rounded bg-[#F3C988] px-1.5 py-0.5 text-[11px] font-semibold text-[#141a10]">
                      {t('Changed')}
                    </span>
                  )}
                </th>
                <td className="border-b border-[#222922] px-3 py-2">{row.latest}</td>
                <td className="border-b border-[#222922] px-3 py-2">{row.earlier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CompareDialog({
  latest,
  earlier,
  loadResult,
  onClose,
}: {
  latest: PredictionExecution;
  earlier: PredictionExecution;
  loadResult: (execution: PredictionExecution) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation('AiPredictions');
  const state = useLoaded(() =>
    Promise.all([loadResult(latest), loadResult(earlier)]).then(([latestResult, earlierResult]) =>
      compareResults(latestResult, earlierResult)
    )
  );
  return (
    <DialogShell
      title={t('Compare with latest')}
      subtitle={t('{{earlier}} compared with {{latest}}', {
        earlier: describe(earlier),
        latest: describe(latest),
      })}
      onClose={onClose}
      testId="ai-predictions-compare"
    >
      {state.status === 'loading' && <p role="status">{t('Loading the results…')}</p>}
      {state.status === 'error' && <p role="alert">{t('The results could not be loaded.')}</p>}
      {state.status === 'ready' && <ComparisonView comparison={state.value} />}
    </DialogShell>
  );
}
