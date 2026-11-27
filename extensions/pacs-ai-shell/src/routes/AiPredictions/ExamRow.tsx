import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { studyOpenPath } from '@pacs-ai/extension-core/src/utils/viewerUrl';
import type { ExecutionResults, KeyResultState } from './useExecutionResults';
import { ExamRetrievalError, type ExamRetriever } from './examRetrieval';
import {
  canRunAgain,
  countsLine,
  examChips,
  examInProgress,
  executionLauncherName,
  failureReason,
  formatDateTime,
  launchedBySummary,
  noResultText,
  STATE_CLASSES,
  stateLabel,
  triggerOrigin,
} from './presentation';
import type {
  PredictionExam,
  PredictionExecution,
  PredictionModel,
  PredictionStudyLabels,
} from './types';

export interface PredictionsActions {
  results: ExecutionResults;
  openResult(
    studyInstanceUID: string,
    execution: PredictionExecution,
    trigger: HTMLElement | null
  ): void;
  openRaw(execution: PredictionExecution): void;
  openCompare(latest: PredictionExecution, earlier: PredictionExecution): void;
  cancel(execution: PredictionExecution): Promise<void>;
  runAgain(exam: PredictionExam, execution: PredictionExecution): Promise<void>;
  canRunAgain(modelName: string): boolean;
  loadHistory(studyInstanceUID: string, modelName: string): Promise<PredictionExecution[]>;
  /** Retrieves exams whose images were removed; null when retrieval is not possible. */
  retriever: ExamRetriever | null;
  /** Opens the viewer on an exam. */
  openExam(studyInstanceUID: string): void;
}

export const BUTTON_CLASS =
  'inline-flex min-h-[44px] items-center rounded-lg border border-[#3A4438] px-3 text-[13px] text-[#E8ECE6] hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#C8F469] disabled:cursor-not-allowed disabled:opacity-60';
const LINK_BUTTON_CLASS =
  'inline-flex min-h-[44px] items-center px-2 text-[13px] text-[#C8F469] underline-offset-2 hover:text-[#E3FAAE] hover:underline focus:outline-none focus:ring-2 focus:ring-[#C8F469] rounded';
const MUTED = 'text-[#A9B3A6]';

export function StateBadge({
  state,
  small = false,
}: {
  state: PredictionExecution['state'];
  small?: boolean;
}) {
  const { t } = useTranslation('AiPredictions');
  return (
    <span
      className={`inline-block rounded-xl font-semibold ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'} ${STATE_CLASSES[state]}`}
      data-testid="ai-predictions-state"
    >
      {stateLabel(state, t)}
    </span>
  );
}

function keyResultText(
  execution: PredictionExecution,
  state: KeyResultState,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (execution.state !== 'completed') {
    return noResultText(execution, t);
  }
  switch (state.status) {
    case 'loading':
      return t('Loading…');
    case 'error':
      return t('Result unavailable');
    case 'ready':
      return state.text ?? '—';
    default:
      return '—';
  }
}

function when(execution: PredictionExecution): string {
  const value = execution.completedAt ?? execution.startedAt ?? execution.runCreatedAt;
  const { time, date } = formatDateTime(value);
  return date ? `${date} ${time}` : time;
}

function WhyButton({ execution }: { execution: PredictionExecution }) {
  const { t } = useTranslation('AiPredictions');
  const [open, setOpen] = useState(false);
  const id = useId();
  const reason = failureReason(execution, t);
  if (!reason) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        className={LINK_BUTTON_CLASS}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(value => !value)}
      >
        {t('Why')}
      </button>
      {open && (
        <p
          id={id}
          className="basis-full rounded-md border border-[#3A4438] bg-[#101410] px-3 py-2 text-[13px] text-[#E8ECE6]"
        >
          {reason}
        </p>
      )}
    </>
  );
}

function HistoryRow({
  studyInstanceUID,
  latest,
  execution,
  actions,
}: {
  studyInstanceUID: string;
  latest: PredictionModel;
  execution: PredictionExecution;
  actions: PredictionsActions;
}) {
  const { t } = useTranslation('AiPredictions');
  const keyState = actions.results.keyResult(execution);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className={`w-[150px] shrink-0 ${MUTED}`}>{when(execution)}</span>
      <span className="w-[64px] shrink-0">
        {execution.modelVersion ? `v${execution.modelVersion}` : '—'}
      </span>
      <span className="min-w-[200px] flex-1">{keyResultText(execution, keyState, t)}</span>
      <span className="w-[150px] shrink-0">{executionLauncherName(execution, t)}</span>
      <StateBadge
        state={execution.state}
        small
      />
      {execution.state === 'completed' && (
        <button
          type="button"
          className={LINK_BUTTON_CLASS}
          onClick={event => actions.openResult(studyInstanceUID, execution, event.currentTarget)}
        >
          {t('Result')}
        </button>
      )}
      {execution.state === 'completed' && latest.state === 'completed' && (
        <button
          type="button"
          className={LINK_BUTTON_CLASS}
          onClick={() => actions.openCompare(latest, execution)}
        >
          {t('Compare with latest')}
        </button>
      )}
      {(execution.state === 'failed' || execution.state === 'skipped') && (
        <WhyButton execution={execution} />
      )}
    </li>
  );
}

type HistoryState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'ready'; executions: PredictionExecution[] }
  | { status: 'error' };

type ActionPhase =
  | { status: 'idle' }
  | { status: 'confirm' }
  | { status: 'submitting' }
  | { status: 'done' }
  | { status: 'error' };

export function ModelRunRow({
  exam,
  model,
  actions,
}: {
  exam: PredictionExam;
  model: PredictionModel;
  actions: PredictionsActions;
}) {
  const { t } = useTranslation('AiPredictions');
  const [history, setHistory] = useState<HistoryState>({ status: 'closed' });
  const [cancelPhase, setCancelPhase] = useState<ActionPhase>({ status: 'idle' });
  const [runPhase, setRunPhase] = useState<ActionPhase>({ status: 'idle' });
  const historyId = useId();
  const { results } = actions;

  useEffect(() => {
    results.requestKeyResult(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.executionId]);

  const earlier = history.status === 'ready' ? history.executions : [];
  useEffect(() => {
    earlier.forEach(execution => results.requestKeyResult(execution));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const keyState = results.keyResult(model);
  const previousCompleted = earlier.find(execution => execution.state === 'completed');
  const previousKey = previousCompleted ? results.keyResult(previousCompleted) : null;
  const differs =
    keyState.status === 'ready' &&
    previousKey?.status === 'ready' &&
    keyState.text !== null &&
    previousKey.text !== null &&
    keyState.text !== previousKey.text;

  const toggleHistory = () => {
    if (history.status !== 'closed') {
      setHistory({ status: 'closed' });
      return;
    }
    setHistory({ status: 'loading' });
    actions.loadHistory(exam.studyInstanceUID, model.modelName).then(
      executions =>
        setHistory({
          status: 'ready',
          executions: executions.filter(execution => execution.executionId !== model.executionId),
        }),
      () => setHistory({ status: 'error' })
    );
  };

  const sameRunCancellable = exam.models
    .filter(other => other.runId === model.runId && other.cancellable)
    .map(other => other.modelName);

  const confirmCancel = () => {
    setCancelPhase({ status: 'submitting' });
    actions.cancel(model).then(
      () => setCancelPhase({ status: 'done' }),
      () => setCancelPhase({ status: 'error' })
    );
  };

  const runAgain = () => {
    setRunPhase({ status: 'submitting' });
    actions.runAgain(exam, model).then(
      () => setRunPhase({ status: 'done' }),
      () => setRunPhase({ status: 'error' })
    );
  };

  // A stalled model never started: cancelling it closes a run that would
  // otherwise stay open for ever.
  const closes = model.state === 'stalled';
  const origin = triggerOrigin(model.trigger, t);
  const time = formatDateTime(model.completedAt ?? model.startedAt ?? model.runCreatedAt).time;
  const earlierLabel =
    model.earlierRuns === 1
      ? t('1 earlier run')
      : t('{{count}} earlier runs', { count: model.earlierRuns });

  return (
    <li
      className="rounded-lg border border-[#2B332A]"
      data-testid={`ai-predictions-model-${model.modelName}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2.5">
        <span className="w-[150px] shrink-0 font-semibold">{model.modelName}</span>
        <span className="w-[64px] shrink-0">
          {model.modelVersion ? `v${model.modelVersion}` : '—'}
        </span>
        <div className="min-w-[200px] flex-1">
          <span
            className={model.state === 'completed' ? undefined : 'text-[#C9D1C6]'}
            data-testid="ai-predictions-key-result"
          >
            {keyResultText(model, keyState, t)}
          </span>
          {differs && (
            <div className="text-xs text-[#F3C988]">{t('Differs from the previous run')}</div>
          )}
        </div>
        <div className="w-[170px] shrink-0">
          {executionLauncherName(model, t)}
          <div className={`text-xs ${MUTED}`}>{[origin, time].filter(Boolean).join(' · ')}</div>
        </div>
        <StateBadge state={model.state} />
        {model.state === 'completed' && (
          <>
            <button
              type="button"
              className={LINK_BUTTON_CLASS}
              onClick={event =>
                actions.openResult(exam.studyInstanceUID, model, event.currentTarget)
              }
            >
              {t('Result')}
            </button>
            <button
              type="button"
              className={LINK_BUTTON_CLASS}
              onClick={() => actions.openRaw(model)}
            >
              {t('Raw data')}
            </button>
          </>
        )}
        {model.cancellable && cancelPhase.status === 'idle' && (
          <button
            type="button"
            className={`${BUTTON_CLASS} border-[#7A4A3C] text-[#FFB199]`}
            onClick={() => setCancelPhase({ status: 'confirm' })}
          >
            {closes ? t('Close') : t('Cancel')}
          </button>
        )}
        {(model.state === 'failed' || model.state === 'skipped') && <WhyButton execution={model} />}
        {canRunAgain(model) &&
          actions.canRunAgain(model.modelName) &&
          runPhase.status !== 'done' && (
            <button
              type="button"
              className={LINK_BUTTON_CLASS}
              onClick={runAgain}
              disabled={runPhase.status === 'submitting'}
            >
              {runPhase.status === 'submitting' ? t('Starting…') : t('Run again')}
            </button>
          )}
        {model.earlierRuns > 0 && (
          <button
            type="button"
            className={BUTTON_CLASS}
            aria-expanded={history.status !== 'closed'}
            aria-controls={historyId}
            onClick={toggleHistory}
          >
            {earlierLabel} {history.status === 'closed' ? '▾' : '▴'}
          </button>
        )}
      </div>

      {cancelPhase.status === 'confirm' && (
        <div
          className="flex flex-wrap items-center gap-3 border-t border-[#2B332A] px-3.5 py-2.5 text-[13px]"
          role="group"
          aria-label={closes ? t('Confirm closing') : t('Confirm cancellation')}
        >
          <span className="flex-1">
            {closes
              ? t(
                  'This run never started and will not start by itself. Closing it marks the run as cancelled; models that have not started are closed {{models}}',
                  { models: sameRunCancellable.join(', ') || model.modelName }
                )
              : t('This cancels every model of this run that has not started {{models}}', {
                  models: sameRunCancellable.join(', ') || model.modelName,
                })}
          </span>
          <button
            type="button"
            className={`${BUTTON_CLASS} border-[#7A4A3C] text-[#FFB199]`}
            onClick={confirmCancel}
          >
            {closes ? t('Close the run') : t('Cancel these models')}
          </button>
          <button
            type="button"
            className={BUTTON_CLASS}
            onClick={() => setCancelPhase({ status: 'idle' })}
          >
            {t('Keep them')}
          </button>
        </div>
      )}
      {(cancelPhase.status === 'submitting' ||
        cancelPhase.status === 'done' ||
        cancelPhase.status === 'error') && (
        <p
          className="border-t border-[#2B332A] px-3.5 py-2 text-[13px]"
          role={cancelPhase.status === 'error' ? 'alert' : 'status'}
        >
          {cancelPhase.status === 'submitting' && (closes ? t('Closing…') : t('Cancelling…'))}
          {cancelPhase.status === 'done' &&
            (closes
              ? t('Closed. The run is marked as cancelled.')
              : t('Cancelled. Models already computing will finish.'))}
          {cancelPhase.status === 'error' &&
            (closes ? t('The run could not be closed.') : t('The models could not be cancelled.'))}
        </p>
      )}
      {(runPhase.status === 'done' || runPhase.status === 'error') && (
        <p
          className="border-t border-[#2B332A] px-3.5 py-2 text-[13px]"
          role={runPhase.status === 'error' ? 'alert' : 'status'}
        >
          {runPhase.status === 'done'
            ? t('A new run was started.')
            : t('The model could not be started.')}
        </p>
      )}

      {history.status !== 'closed' && (
        <div
          id={historyId}
          className="border-t border-[#2B332A] py-2 pl-7 pr-3.5"
        >
          {history.status === 'loading' && (
            <p
              role="status"
              className={`text-xs ${MUTED}`}
            >
              {t('Loading the earlier runs…')}
            </p>
          )}
          {history.status === 'error' && (
            <p
              role="alert"
              className="text-xs"
            >
              {t('The earlier runs could not be loaded.')}
            </p>
          )}
          {history.status === 'ready' && (
            <ul
              className="flex flex-col gap-1.5"
              aria-label={t('Earlier runs of {{model}}', { model: model.modelName })}
            >
              {history.executions.map(execution => (
                <HistoryRow
                  key={execution.executionId}
                  studyInstanceUID={exam.studyInstanceUID}
                  latest={model}
                  execution={execution}
                  actions={actions}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

const OPEN_LINK_CLASS =
  'inline-flex min-h-[44px] items-center rounded px-2.5 text-[#C8F469] hover:text-[#E3FAAE] focus:outline-none focus:ring-2 focus:ring-[#C8F469]';

/**
 * The name line: the name from the local store; "Unknown patient" only when
 * the store has the study without a name. The gateway stores no names, so an
 * exam whose images were removed has none.
 */
function patientNameText(
  stored: PredictionStudyLabels['stored'] | null,
  patientName: string | null,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (patientName) {
    return patientName;
  }
  switch (stored) {
    case 'yes':
      return t('Unknown patient');
    case 'no':
      return t('Patient name unavailable (images removed)');
    case 'unknown':
      return t('Patient name unavailable');
    default:
      return t('Loading…');
  }
}

type RetrievePhase =
  | { status: 'resolving' }
  | { status: 'ready'; modalityId: string }
  | { status: 'unavailable' }
  | { status: 'retrieving'; modalityId: string; percent: number | null }
  | { status: 'error'; modalityId: string; timedOut: boolean };

/**
 * For an exam whose images were removed from the local store: retrieves it
 * from its PACS source, shows the progress, then opens the viewer. Without a
 * PACS source the button stays focusable but cannot be activated.
 */
export function RetrieveAndOpen({
  studyInstanceUID,
  actions,
}: {
  studyInstanceUID: string;
  actions: PredictionsActions;
}) {
  const { t } = useTranslation('AiPredictions');
  const [phase, setPhase] = useState<RetrievePhase>({ status: 'resolving' });
  const tooltipId = useId();
  const { retriever } = actions;
  const mounted = React.useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!retriever) {
      setPhase({ status: 'unavailable' });
      return () => {
        mounted.current = false;
      };
    }
    retriever.source(studyInstanceUID).then(
      modalityId => {
        if (mounted.current) {
          setPhase(modalityId ? { status: 'ready', modalityId } : { status: 'unavailable' });
        }
      },
      () => mounted.current && setPhase({ status: 'unavailable' })
    );
    return () => {
      mounted.current = false;
    };
  }, [retriever, studyInstanceUID]);

  const start = (modalityId: string) => {
    if (!retriever) {
      return;
    }
    setPhase({ status: 'retrieving', modalityId, percent: null });
    retriever
      .retrieve(
        studyInstanceUID,
        modalityId,
        percent => mounted.current && setPhase({ status: 'retrieving', modalityId, percent }),
        () => !mounted.current
      )
      .then(
        completed => {
          if (completed && mounted.current) {
            actions.openExam(studyInstanceUID);
          }
        },
        (error: unknown) =>
          mounted.current &&
          setPhase({
            status: 'error',
            modalityId,
            timedOut: error instanceof ExamRetrievalError && error.reason === 'timedOut',
          })
      );
  };

  if (phase.status === 'resolving') {
    return (
      <span className={`inline-flex min-h-[44px] items-center px-2.5 text-[13px] ${MUTED}`}>
        {t('Loading…')}
      </span>
    );
  }

  if (phase.status === 'unavailable') {
    return (
      <span className="inline-flex flex-col">
        <button
          type="button"
          className={`${OPEN_LINK_CLASS} cursor-not-allowed text-[#A9B3A6] hover:text-[#A9B3A6]`}
          aria-disabled="true"
          aria-describedby={tooltipId}
          title={t('This exam is no longer stored on this server')}
          onClick={event => event.preventDefault()}
          data-testid="ai-predictions-open-unavailable"
        >
          {t('Open exam')}
        </button>
        <span
          id={tooltipId}
          className="sr-only"
        >
          {t('This exam is no longer stored on this server')}
        </span>
      </span>
    );
  }

  if (phase.status === 'retrieving') {
    return (
      <span
        role="status"
        className={`inline-flex min-h-[44px] items-center px-2.5 text-[13px] ${MUTED}`}
        data-testid="ai-predictions-retrieving"
      >
        {phase.percent === null
          ? t('Retrieving from PACS…')
          : t('Retrieving from PACS… {{percent}}%', { percent: phase.percent })}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className={OPEN_LINK_CLASS}
        onClick={() => start(phase.modalityId)}
      >
        {phase.status === 'error' ? t('Try the retrieval again') : t('Retrieve from PACS and open')}
      </button>
      {phase.status === 'error' && (
        <span
          role="alert"
          className="max-w-[220px] whitespace-normal px-2.5 text-xs text-[#FFB199]"
        >
          {phase.timedOut
            ? t('Retrieving the exam from the PACS took too long.')
            : t('The exam could not be retrieved from the PACS.')}
        </span>
      )}
    </span>
  );
}

export function ExamRow({
  exam,
  labels,
  expanded,
  onToggle,
  actions,
  now,
}: {
  exam: PredictionExam;
  labels: PredictionStudyLabels | undefined;
  expanded: boolean;
  onToggle: () => void;
  actions: PredictionsActions;
  now: number;
}) {
  const { t } = useTranslation('AiPredictions');
  const detailsId = useId();
  const chips = examChips(exam, now, t);
  const launched = launchedBySummary(exam.launchers, t);
  const activity = formatDateTime(exam.lastActivityAt);
  const inProgress = examInProgress(exam);
  const stored = labels?.stored ?? null;
  const patientName = labels?.patientName ?? null;
  const patientId = labels?.patientId ?? exam.patientId;
  const description = [
    patientId ? t('MRN {{mrn}}', { mrn: patientId }) : null,
    labels?.modalitiesInStudy ?? exam.modalitiesInStudy?.replace(/\\/g, ', '),
    labels?.studyDescription,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <tr
        className={expanded ? 'bg-[#1B231A]' : undefined}
        data-testid="ai-predictions-exam"
      >
        <td className="border-b border-[#222922] p-3 align-top">
          <button
            type="button"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg focus:outline-none focus:ring-2 focus:ring-[#C8F469] ${
              expanded
                ? 'border-[#C8F469] bg-[#263018] text-[#E3FAAE]'
                : 'border-[#3A4438] text-[#E8ECE6]'
            }`}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={
              expanded
                ? t('Collapse exam of {{patient}}', {
                    patient: patientName ?? patientId ?? exam.studyInstanceUID,
                  })
                : t('Expand exam of {{patient}}', {
                    patient: patientName ?? patientId ?? exam.studyInstanceUID,
                  })
            }
            onClick={onToggle}
          >
            <span aria-hidden="true">{expanded ? '−' : '+'}</span>
          </button>
        </td>
        <td className="whitespace-nowrap border-b border-[#222922] p-3 align-top text-[13px]">
          {inProgress ? (
            <span className={MUTED}>{t('in progress')}</span>
          ) : (
            <>
              {activity.time}
              <div className={`text-xs ${MUTED}`}>{activity.date}</div>
            </>
          )}
        </td>
        <td className="border-b border-[#222922] p-3 align-top text-[13px]">
          <div
            className="font-semibold"
            data-testid="ai-predictions-patient"
          >
            {patientNameText(stored, patientName, t)}
          </div>
          {stored === 'no' && (
            <div
              className="mt-0.5 inline-block rounded-md bg-[#2A2A2A] px-1.5 py-0.5 text-[11px] text-[#D2D2D2]"
              data-testid="ai-predictions-images-removed"
            >
              {t('Images removed after 24 h')}
            </div>
          )}
          {description && <div className={`text-xs ${MUTED}`}>{description}</div>}
        </td>
        <td className="border-b border-[#222922] p-3 align-top text-[13px]">
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={t('Models')}
          >
            {chips.map(chip => (
              <li
                key={chip.key}
                className={`rounded-xl px-2.5 py-0.5 text-xs font-semibold ${STATE_CLASSES[chip.state]}`}
                data-testid="ai-predictions-chip"
                data-state={chip.state}
              >
                <span aria-hidden="true">{chip.text}</span>
                <span className="sr-only">{chip.label}</span>
              </li>
            ))}
          </ul>
          {chips.length > 1 || chips[0]?.key !== 'all-completed' ? (
            <div className={`mt-1.5 text-xs ${MUTED}`}>{countsLine(exam.counts, t)}</div>
          ) : null}
        </td>
        <td className="border-b border-[#222922] p-3 align-top text-[13px]">
          {launched.primary}
          {launched.detail && <div className={`text-xs ${MUTED}`}>{launched.detail}</div>}
        </td>
        <td className="whitespace-nowrap border-b border-[#222922] p-3 align-top text-[13px]">
          {stored === 'no' ? (
            <RetrieveAndOpen
              studyInstanceUID={exam.studyInstanceUID}
              actions={actions}
            />
          ) : (
            <Link
              to={studyOpenPath(exam.studyInstanceUID)}
              className={OPEN_LINK_CLASS}
            >
              {t('Open exam')}
            </Link>
          )}
        </td>
      </tr>
      {expanded && (
        <tr
          id={detailsId}
          className="bg-[#141a14]"
        >
          <td className="border-b border-[#222922]" />
          <td
            colSpan={5}
            className="border-b border-[#222922] px-3 pb-4 pt-1"
          >
            <ul
              className="mt-2 flex flex-col gap-2"
              aria-label={t('Models of this exam')}
            >
              {exam.models.map(model => (
                <ModelRunRow
                  key={model.executionId}
                  exam={exam}
                  model={model}
                  actions={actions}
                />
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
