import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import refreshIcon from '../../../assets/pacs/icons/refresh.png';
import type { GetInferenceAvailableModelsResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import {
  DEFAULT_REJECT_REASON_LABELS,
  type DefaultRejectReasonId,
} from '@pacs-ai/extension-core/src/feedback/defaultRejectQuestionnaire';
import { serializeCSV } from '../../AiPredictions/csvExport';
import { useFeedbackReportCounts } from '../hooks/useFeedbackReportCounts';
import { useModelFeedback } from '../hooks/useModelFeedback';
import ApprovalTrendChart from '../model-feedback/components/ApprovalTrendChart';
import FeedbackKpiTiles from '../model-feedback/components/FeedbackKpiTiles';
import ModelApprovalPanels from '../model-feedback/components/ModelApprovalPanels';
import ModelFeedbackTable from '../model-feedback/components/ModelFeedbackTable';
import RatedModelsTable from '../model-feedback/components/RatedModelsTable';
import RatingsPerWeekChart, {
  RatingsPerWeekLegend,
} from '../model-feedback/components/RatingsPerWeekChart';
import RejectionReasonsBars from '../model-feedback/components/RejectionReasonsBars';
import {
  cardClassName,
  cardSubtitleClassName,
  cardTitleClassName,
  longDate,
} from '../model-feedback/components/dashboardTheme';
import {
  ALL_FILTERS,
  MAX_MODEL_PANELS,
  REVIEW_THRESHOLD,
  UNSPECIFIED_REASON_ID,
  buildDashboard,
  filterOptions,
  filterVotes,
  rangeWindow,
  rejectReasonId,
  type FeedbackDashboardFilters,
  type FeedbackRange,
} from '../model-feedback/feedbackDashboardModel';
import {
  feedbackCSVRows,
  filterFeedbackItems,
  modelLabel,
  type FeedbackVoteFilter,
} from '../model-feedback/modelFeedbackModel';

type ModelFeedbackSectionProps = {
  active: boolean;
  availableModels: GetInferenceAvailableModelsResponse[];
  tenantName?: string;
  // Saves the exported CSV; replaced in tests.
  saveFile?: (fileName: string, text: string) => void;
  // The current time; replaced in tests and screenshots.
  clock?: () => Date;
};

function defaultSaveFile(fileName: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => window.URL.revokeObjectURL(url), 100);
}

const defaultClock = () => new Date();

const RANGE_OPTIONS: FeedbackRange[] = ['30d', '90d', '12m'];

const selectClassName =
  'h-[38px] min-w-[150px] rounded-lg border border-white/15 bg-[#1B1F1B] px-3 text-sm text-white focus:border-[#C8F469] focus:outline-none';
const inputClassName =
  'h-[35px] rounded-lg border border-white/20 bg-[#232823] px-3 text-sm text-white focus:border-[#C8F469] focus:outline-none';
const accentButtonClassName =
  'h-[38px] rounded-lg bg-gradient-to-r from-[#C8F469] to-[#05905E] px-5 text-sm font-semibold text-[#0E120E] disabled:cursor-not-allowed disabled:opacity-50';

function CardHeader({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
      <div>
        <h2 className={cardTitleClassName}>{title}</h2>
        {subtitle && <p className={cardSubtitleClassName}>{subtitle}</p>}
      </div>
      {aside}
    </div>
  );
}

const ModelFeedbackSection = ({
  active,
  availableModels,
  tenantName,
  saveFile = defaultSaveFile,
  clock = defaultClock,
}: ModelFeedbackSectionProps) => {
  const { t, i18n } = useTranslation('ModelFeedback');
  const language = i18n?.language;
  const [range, setRange] = useState<FeedbackRange>('90d');
  const [filters, setFilters] = useState<FeedbackDashboardFilters>(ALL_FILTERS);
  const [feedbackType, setFeedbackType] = useState<FeedbackVoteFilter>('');
  const [userSearch, setUserSearch] = useState('');
  const [now, setNow] = useState(clock);
  const [reloadKey, setReloadKey] = useState(0);

  const span = useMemo(() => rangeWindow(range, now), [range, now]);
  const query = useMemo(
    () => ({
      model: '',
      from: span.priorFrom.toISOString(),
      to: span.to.toISOString(),
    }),
    [span]
  );
  const countsQuery = useMemo(
    () => ({
      priorFrom: span.priorFrom.toISOString(),
      from: span.from.toISOString(),
      to: span.to.toISOString(),
    }),
    [span]
  );
  const feedback = useModelFeedback({ active, query });
  const reportCounts = useFeedbackReportCounts({ active, query: countsQuery, reloadKey });
  const allItems = useMemo(() => feedback.data?.items ?? [], [feedback.data]);

  const dashboard = useMemo(
    () =>
      buildDashboard({
        items: allItems,
        availableModels,
        filters,
        window: span,
        reportCounts,
      }),
    [allItems, availableModels, filters, span, reportCounts]
  );
  const options = useMemo(
    () => filterOptions(allItems, availableModels),
    [allItems, availableModels]
  );

  // Votes in the current period under every filter, for the table and CSV.
  const votes = useMemo(() => {
    const fromS = span.from.getTime() / 1000;
    const toS = span.to.getTime() / 1000;
    const current = filterVotes(allItems, filters, availableModels).filter(
      item => item.updatedAt >= fromS && item.updatedAt < toS
    );
    return filterFeedbackItems(current, { feedbackType, userSearch });
  }, [allItems, filters, availableModels, span, feedbackType, userSearch]);

  const modelName = (inferenceModelId: string) => modelLabel(inferenceModelId, availableModels);
  const reasonLabel = (id: string) =>
    id === UNSPECIFIED_REASON_ID
      ? t('No reason given')
      : t(DEFAULT_REJECT_REASON_LABELS[id as DefaultRejectReasonId] ?? id);
  const voteLabel = (type: string) =>
    type?.toUpperCase() === 'APPROVE' ? t('Approved') : t('Rejected');

  const periodLabel = { '30d': t('30 days'), '90d': t('90 days'), '12m': t('12 months') }[range];
  const spanLabel = {
    '30d': t('30 days'),
    '90d': t('{{count}} weeks', { count: 13 }),
    '12m': t('{{count}} weeks', { count: 52 }),
  }[range];

  const refresh = () => {
    setNow(clock());
    setReloadKey(key => key + 1);
    feedback.refresh();
  };

  const setFilter = (name: keyof FeedbackDashboardFilters) => (value: string) =>
    setFilters(current => ({ ...current, [name]: value }));

  const exportCSV = () => {
    const rows = feedbackCSVRows(votes, {
      headers: {
        updatedAt: t('Updated at'),
        createdAt: t('Created at'),
        model: t('Model'),
        modelId: t('Model ID'),
        version: t('Version'),
        vote: t('Vote'),
        reason: t('Rejection reason'),
        userName: t('User name'),
        userEmail: t('User email'),
        userId: t('User ID'),
        runId: t('Run ID'),
        executionId: t('Execution ID'),
        studyServiceJobId: t('Study-service job ID'),
        answers: t('Answers'),
      },
      vote: voteLabel,
      model: modelName,
      reason: item =>
        item.feedbackType?.toUpperCase() === 'REJECT' ? reasonLabel(rejectReasonId(item)) : '',
    });
    const date = clock().toISOString().slice(0, 10);
    saveFile(`model-feedback-${date}.csv`, serializeCSV(rows));
  };

  const hasData = !!feedback.data;
  const lastDay = new Date(span.to.getTime() - 1);
  const subtitle = [
    t('Reader ratings on inference output'),
    tenantName ? t('Tenant {{name}}', { name: tenantName }) : null,
    t('{{span}} to {{date}}', { span: spanLabel, date: longDate(lastDay, language) }),
  ]
    .filter(Boolean)
    .join(' · ');
  const panels = dashboard.models.slice(0, MAX_MODEL_PANELS);

  return (
    <div
      data-testid="model-feedback-section"
      className="text-white"
    >
      <div>
        <h1 className="text-[24px] text-white">{t('Model feedback over time')}</h1>
        <p
          className="mt-1 text-sm text-white/60"
          data-testid="model-feedback-subtitle"
        >
          {subtitle}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div
          role="radiogroup"
          aria-label={t('Period')}
          className="border-white/15 flex h-[38px] overflow-hidden rounded-lg border bg-[#1B1F1B]"
        >
          {RANGE_OPTIONS.map(option => {
            const checked = option === range;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setRange(option)}
                className={`px-4 text-sm ${
                  checked
                    ? 'bg-gradient-to-r from-[#C8F469] to-[#05905E] font-semibold text-[#0E120E]'
                    : 'text-white/85 hover:bg-white/5'
                }`}
                data-testid={`model-feedback-range-${option}`}
              >
                {option}
              </button>
            );
          })}
        </div>
        <select
          aria-label={t('Modality')}
          className={selectClassName}
          value={filters.modality}
          onChange={event => setFilter('modality')(event.target.value)}
          data-testid="model-feedback-modality-filter"
        >
          <option value="">{t('All modalities')}</option>
          {options.modalities.map(value => (
            <option
              key={value}
              value={value}
            >
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Output mode')}
          className={selectClassName}
          value={filters.outputMode}
          onChange={event => setFilter('outputMode')(event.target.value)}
          data-testid="model-feedback-output-filter"
        >
          <option value="">{t('All output modes')}</option>
          {options.outputModes.map(value => (
            <option
              key={value}
              value={value}
            >
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Reader')}
          className={selectClassName}
          value={filters.reader}
          onChange={event => setFilter('reader')(event.target.value)}
          data-testid="model-feedback-reader-filter"
        >
          <option value="">{t('All readers')}</option>
          {options.readers.map(reader => (
            <option
              key={reader.id}
              value={reader.id}
            >
              {reader.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={feedback.loading}
            className="border-white/15 text-white/85 flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm hover:bg-white/5"
            onClick={refresh}
            data-testid="model-feedback-refresh"
          >
            <img
              src={refreshIcon}
              alt=""
              className={`${feedback.loading ? 'animate-spin' : ''} h-4 w-4`}
            />
            {t('Refresh')}
          </button>
          <button
            type="button"
            disabled={!votes.length}
            className={accentButtonClassName}
            onClick={exportCSV}
            data-testid="model-feedback-export"
          >
            {t('Export CSV')}
          </button>
        </div>
      </div>

      {feedback.error && (
        <p
          role="alert"
          className="mt-5 text-sm text-[#F87171]"
          data-testid="model-feedback-error"
        >
          {t('Model feedback could not be loaded.')}
        </p>
      )}

      {feedback.loading && !hasData && (
        <p
          role="status"
          className="mt-5 text-sm text-white/60"
        >
          {t('Loading...')}
        </p>
      )}

      {hasData && (
        <>
          {feedback.data?.truncated && (
            <p
              className="mt-4 rounded-lg border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-sm text-yellow-200"
              data-testid="model-feedback-truncated"
            >
              {t(
                'Only the {{count}} most recent votes were loaded; older votes in this period are not counted.',
                { count: feedback.data.items.length }
              )}
            </p>
          )}

          <div className="mt-6">
            <FeedbackKpiTiles
              kpis={dashboard.kpis}
              period={periodLabel}
            />
          </div>

          <section
            className={`${cardClassName} mt-6`}
            data-testid="model-feedback-weekly"
          >
            <CardHeader
              title={t('Ratings per week')}
              subtitle={t(
                'Polarity is carried by position first, up above the baseline and down below, so the chart still reads without colour.'
              )}
              aside={<RatingsPerWeekLegend />}
            />
            <div className="mt-4">
              <RatingsPerWeekChart weeks={dashboard.weeks} />
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
            <section
              className={cardClassName}
              data-testid="model-feedback-trend"
            >
              <CardHeader
                title={t('Approval rate trend')}
                subtitle={t('All models combined, against the {{threshold}}% review threshold.', {
                  threshold: Math.round(REVIEW_THRESHOLD * 100),
                })}
              />
              <div className="mt-4">
                <ApprovalTrendChart
                  weeks={dashboard.weeks}
                  threshold={REVIEW_THRESHOLD}
                />
              </div>
            </section>
            <section
              className={cardClassName}
              data-testid="model-feedback-reasons-card"
            >
              <CardHeader
                title={t('Why readers rejected')}
                subtitle={t('From the rejection questionnaire, all {{count}} thumbs down.', {
                  count: dashboard.kpis.down,
                })}
              />
              <RejectionReasonsBars
                reasons={dashboard.reasons}
                reasonLabel={reasonLabel}
              />
            </section>
          </div>

          <section
            className={`${cardClassName} mt-6`}
            data-testid="model-feedback-panels"
          >
            <CardHeader
              title={t('Approval rate by model')}
              aside={
                panels.length > 0 && (
                  <span className="text-white/55 text-[13px]">
                    {t('Every panel on the same {{min}}–{{max}}% scale', dashboard.scale)}
                  </span>
                )
              }
            />
            {panels.length ? (
              <ModelApprovalPanels
                models={panels}
                scale={dashboard.scale}
              />
            ) : (
              <p
                className="text-white/55 mt-4 text-sm"
                data-testid="model-feedback-empty"
              >
                {t('No ratings in this period')}
              </p>
            )}
          </section>

          {dashboard.models.length > 0 && (
            <section
              className={`${cardClassName} mt-6`}
              data-testid="model-feedback-models"
            >
              <CardHeader
                title={t('All rated models')}
                aside={
                  <span className="text-white/55 text-[13px]">{t('Sorted by rating volume')}</span>
                }
              />
              <RatedModelsTable
                models={dashboard.models}
                reasonLabel={reasonLabel}
                now={now}
              />
            </section>
          )}

          <details
            className={`${cardClassName} group mt-6`}
            data-testid="model-feedback-votes"
          >
            <summary className="cursor-pointer select-none text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">
              {t('Individual votes')} ({votes.length})
            </summary>
            <div className="mt-4 flex flex-wrap items-end gap-3 text-sm text-white/80">
              <label className="flex flex-col gap-1">
                {t('Vote')}
                <select
                  className={inputClassName}
                  value={feedbackType}
                  onChange={event => setFeedbackType(event.target.value as FeedbackVoteFilter)}
                  data-testid="model-feedback-vote-filter"
                >
                  <option value="">{t('All votes')}</option>
                  <option value="APPROVE">{t('Approved')}</option>
                  <option value="REJECT">{t('Rejected')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {t('User')}
                <input
                  type="search"
                  className={inputClassName}
                  value={userSearch}
                  placeholder={t('Name or email')}
                  onChange={event => setUserSearch(event.target.value)}
                  data-testid="model-feedback-user-search"
                />
              </label>
            </div>
            <div className="mt-4">
              {votes.length ? (
                <ModelFeedbackTable
                  items={votes}
                  modelName={modelName}
                />
              ) : (
                <p className="text-sm text-white/60">{t('No vote matches the filters')}</p>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default ModelFeedbackSection;
