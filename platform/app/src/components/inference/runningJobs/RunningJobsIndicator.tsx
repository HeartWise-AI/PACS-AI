import React from 'react';
import { useTranslation } from 'react-i18next';
import { countRunningJobs, formatClockTime, formatElapsed, rowElapsedMs } from './runningJobsModel';
import type {
  RunningJobCancelState,
  RunningJobRow,
  RunningJobState,
  RunningJobWaiting,
} from './types';

export interface RunningJobsIndicatorProps {
  rows: RunningJobRow[];
  // Epoch milliseconds the elapsed times are computed against.
  now: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClose: () => void;
  onOpenResult?: (row: RunningJobRow) => void;
  // Moves the card aside while the "result ready" notice uses the corner.
  besideReadyNotice?: boolean;
  // Inline cancellation, by row id. Without `onRequestCancel` no row offers it.
  cancelStates?: Readonly<Record<string, RunningJobCancelState>>;
  onRequestCancel?: (row: RunningJobRow) => void;
  onConfirmCancel?: (row: RunningJobRow) => void;
  onAbortCancel?: (row: RunningJobRow) => void;
}

const STATE_LABEL_KEYS: Record<RunningJobState, string> = {
  queued: 'RunningJobsStateQueued',
  running: 'RunningJobsStateRunning',
  finishing: 'RunningJobsStateFinishing',
  done: 'RunningJobsStateDone',
  failed: 'RunningJobsStateFailed',
  skipped: 'RunningJobsStateSkipped',
  cancelled: 'RunningJobsStateCancelled',
};

// What an active row says instead of its state while it only waits.
const WAITING_LABEL_KEYS: Record<RunningJobWaiting, string> = {
  exam: 'RunningJobsStateWaitingExam',
  stale: 'RunningJobsStateStale',
};

const WAITING_TEXT_CLASSES: Record<RunningJobWaiting, string> = {
  exam: 'text-white/70',
  stale: 'text-amber-300',
};

const STATE_TEXT_CLASSES: Record<RunningJobState, string> = {
  queued: 'text-white/60',
  running: 'text-[#c8f469]',
  finishing: 'text-[#c8f469]',
  done: 'text-[#c8f469]',
  failed: 'text-red-400',
  skipped: 'text-amber-300',
  cancelled: 'text-white/60',
};

const PROCESSING_TITLE_KEYS: Record<string, string> = {
  AUTO: 'RunningJobsProcessingAuto',
  MANUAL_REPROCESS: 'RunningJobsProcessingReprocess',
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      data-testid="running-jobs-spinner"
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#c8f469] motion-reduce:animate-none"
    />
  );
}

// A run that only waits: a still ring, amber when it is stuck. No spinner,
// so the card does not suggest that something is being computed.
function WaitingMark({ waiting }: { waiting: RunningJobWaiting }) {
  return (
    <span
      aria-hidden="true"
      data-testid="running-jobs-waiting-mark"
      data-waiting={waiting}
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
        waiting === 'stale' ? 'border-amber-300/80' : 'border-white/30'
      }`}
    />
  );
}

function CancelIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
      />
      <path d="M3.6 3.6l8.8 8.8" />
    </svg>
  );
}

function EndMark({ state }: { state: RunningJobState }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-3.5 shrink-0 text-center text-xs font-bold leading-none ${STATE_TEXT_CLASSES[state]}`}
    >
      {state === 'done' ? '✓' : state === 'failed' ? '✕' : '–'}
    </span>
  );
}

function ProgressBar({ row }: { row: RunningJobRow }) {
  if (!row.active) {
    return null;
  }

  if (row.progress) {
    const { done, total } = row.progress;
    return (
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10"
        data-testid="running-jobs-progress"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
            row.waiting ? 'bg-white/40' : 'bg-[#c8f469]'
          }`}
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
    );
  }

  // No progress is reported for a single model run: indeterminate.
  return (
    <div
      role="progressbar"
      className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10"
      data-testid="running-jobs-progress-indeterminate"
    >
      <div
        className={`h-full w-full rounded-full motion-reduce:animate-none ${
          row.state === 'queued' ? 'bg-white/30' : 'animate-pulse bg-[#c8f469]/70'
        }`}
      />
    </div>
  );
}

/**
 * Floating status card for model runs of the open study: one row per run,
 * collapsible to a pill. Presentational only; rows come from selectRunningJobs.
 */
export function RunningJobsIndicator({
  rows,
  now,
  collapsed,
  onToggleCollapsed,
  onClose,
  onOpenResult,
  besideReadyNotice = false,
  cancelStates,
  onRequestCancel,
  onConfirmCancel,
  onAbortCancel,
}: RunningJobsIndicatorProps) {
  const { t } = useTranslation('AIModelButton');

  if (!rows.length) {
    return null;
  }

  // A run that only waits for the exam to finish is not "running".
  const counts = countRunningJobs(rows);
  const summary =
    [
      counts.running ? t('RunningJobsCountRunning', { total: counts.running }) : null,
      counts.waiting ? t('RunningJobsCountWaiting', { total: counts.waiting }) : null,
    ]
      .filter(Boolean)
      .join(' · ') || t('RunningJobsAllFinished');
  const headerMark = counts.running ? (
    <Spinner />
  ) : counts.waiting ? (
    <WaitingMark waiting={counts.stale ? 'stale' : 'exam'} />
  ) : (
    <EndMark state="done" />
  );
  // z-30: above the viewports, below the top navigation (z-40), dialogs and
  // menus (z-50), the result drawer and its ready notice (z-[9999]).
  const position = `fixed z-30 ${
    besideReadyNotice ? 'bottom-36 right-4 sm:bottom-4 sm:right-[21.5rem]' : 'bottom-4 right-4'
  }`;

  const rowTitle = (row: RunningJobRow) =>
    row.modelName ?? t(PROCESSING_TITLE_KEYS[row.trigger ?? ''] ?? 'RunningJobsProcessingOther');

  if (collapsed) {
    return (
      <div
        className={position}
        role="status"
        aria-live="polite"
        data-testid="running-jobs-indicator"
      >
        <button
          type="button"
          className="border-white/15 flex items-center gap-2 rounded-full border bg-[#232823] px-3 py-1.5 text-xs text-white shadow-xl hover:bg-[#2c322c]"
          onClick={onToggleCollapsed}
          aria-expanded={false}
          aria-label={`${t('RunningJobsExpand')} (${summary})`}
          data-testid="running-jobs-pill"
        >
          {headerMark}
          <span>{summary}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${position} border-white/15 w-[280px] max-w-[calc(100vw-2rem)] rounded-lg border bg-[#232823] text-white shadow-xl`}
      role="status"
      aria-live="polite"
      data-testid="running-jobs-indicator"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5">
        {headerMark}
        <p className="min-w-0 grow truncate text-xs font-semibold">
          {t('RunningJobsTitle')}
          <span className="font-normal text-white/60"> · {summary}</span>
        </p>
        <button
          type="button"
          className="rounded px-1.5 text-sm leading-5 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onToggleCollapsed}
          aria-expanded={true}
          aria-label={t('RunningJobsCollapse')}
          title={t('RunningJobsCollapse')}
          data-testid="running-jobs-collapse"
        >
          <span aria-hidden="true">–</span>
        </button>
        <button
          type="button"
          className="rounded px-1.5 text-sm leading-5 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label={t('RunningJobsClose')}
          title={t('RunningJobsClose')}
          data-testid="running-jobs-close"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <ul className="max-h-60 overflow-y-auto">
        {rows.map(row => {
          const title = rowTitle(row);
          const elapsed = formatElapsed(rowElapsedMs(row, now));
          const canOpen = !!onOpenResult && row.state === 'done' && !!row.result;
          const waiting = row.active ? row.waiting : undefined;
          const cancelState = cancelStates?.[row.id];
          const confirming =
            cancelState?.phase === 'confirming' || cancelState?.phase === 'submitting';
          const submitting = cancelState?.phase === 'submitting';
          const canCancel = row.active && !!row.cancelRunId && !!onRequestCancel;
          const content = (
            <>
              <div className="flex items-center gap-2">
                {waiting ? (
                  <WaitingMark waiting={waiting} />
                ) : row.active ? (
                  <Spinner />
                ) : (
                  <EndMark state={row.state} />
                )}
                <span className="min-w-0 grow truncate text-xs font-medium">{title}</span>
                {waiting ? (
                  // A wait is not a computation running late: no ticking timer.
                  <span
                    className="shrink-0 text-[11px] tabular-nums text-white/40"
                    data-testid="running-jobs-since"
                  >
                    {t('RunningJobsWaitingSince', { time: formatClockTime(row.startedAt) })}
                  </span>
                ) : (
                  <span
                    role="timer"
                    aria-label={t('RunningJobsElapsed', { time: elapsed })}
                    className="shrink-0 text-[11px] tabular-nums text-white/60"
                    data-testid="running-jobs-elapsed"
                  >
                    {elapsed}
                  </span>
                )}
                {canCancel && !confirming && (
                  <button
                    type="button"
                    className="-mr-1 shrink-0 rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
                    onClick={() => onRequestCancel(row)}
                    aria-label={`${t('RunningJobsCancel')}: ${title}`}
                    title={t('RunningJobsCancel')}
                    data-testid="running-jobs-cancel"
                  >
                    <CancelIcon />
                  </button>
                )}
              </div>
              <div className="mt-0.5 flex items-start justify-between gap-2 pl-[22px] text-[11px]">
                <span
                  className={`min-w-0 ${waiting ? WAITING_TEXT_CLASSES[waiting] : STATE_TEXT_CLASSES[row.state]}`}
                  data-testid="running-jobs-state"
                >
                  {t(waiting ? WAITING_LABEL_KEYS[waiting] : STATE_LABEL_KEYS[row.state])}
                  {canOpen && (
                    <span className="text-white/60"> · {t('RunningJobsViewResult')}</span>
                  )}
                </span>
                {row.progress && (
                  <span
                    className="shrink-0 text-white/60"
                    data-testid="running-jobs-count"
                  >
                    {t('RunningJobsProgress', {
                      done: row.progress.done,
                      total: row.progress.total,
                    })}
                  </span>
                )}
              </div>
              {row.active && row.runningModelNames.length > 0 && (
                <p className="mt-0.5 truncate pl-[22px] text-[11px] text-white/60">
                  {row.runningModelNames.join(', ')}
                </p>
              )}
              <ProgressBar row={row} />
              {canCancel && confirming && (
                <div
                  role="group"
                  aria-label={t('RunningJobsCancelConfirm')}
                  className="mt-1.5 pl-[22px] text-[11px]"
                  data-testid="running-jobs-cancel-confirm"
                >
                  <p className="text-white/80">{t('RunningJobsCancelConfirm')}</p>
                  {row.kind === 'processing' && !!row.progress?.done && (
                    <p className="text-white/50">{t('RunningJobsCancelKeepsResults')}</p>
                  )}
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-red-400/60 px-2 py-0.5 text-red-300 hover:bg-red-400/10 disabled:opacity-60"
                      onClick={() => onConfirmCancel?.(row)}
                      disabled={submitting}
                      data-testid="running-jobs-cancel-yes"
                    >
                      {t(submitting ? 'RunningJobsCancelling' : 'RunningJobsCancelConfirmYes')}
                    </button>
                    <button
                      type="button"
                      className="border-white/15 rounded border px-2 py-0.5 text-white/70 hover:bg-white/10 disabled:opacity-60"
                      onClick={() => onAbortCancel?.(row)}
                      disabled={submitting}
                      data-testid="running-jobs-cancel-no"
                    >
                      {t('RunningJobsCancelConfirmNo')}
                    </button>
                  </div>
                </div>
              )}
              {row.active && cancelState?.phase === 'error' && (
                <p
                  role="alert"
                  className="mt-1 pl-[22px] text-[11px] text-red-400"
                  data-testid="running-jobs-cancel-error"
                >
                  {t(
                    cancelState.error === 'tooLate'
                      ? 'RunningJobsCancelTooLate'
                      : 'RunningJobsCancelError'
                  )}
                </p>
              )}
            </>
          );

          return (
            <li
              key={row.id}
              className="border-b border-white/5 last:border-b-0"
              data-testid="running-jobs-row"
              data-state={row.state}
              data-waiting={waiting}
            >
              {canOpen ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => onOpenResult(row)}
                  aria-label={`${title}: ${t('RunningJobsViewResult')}`}
                  data-testid="running-jobs-open-result"
                >
                  {content}
                </button>
              ) : (
                <div className="px-3 py-2">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RunningJobsIndicator;
