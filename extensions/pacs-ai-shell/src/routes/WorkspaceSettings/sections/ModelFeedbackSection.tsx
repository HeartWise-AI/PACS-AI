import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import refreshIcon from '../../../assets/pacs/icons/refresh.png';
import type { GetInferenceAvailableModelsResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import { serializeCSV } from '../../AiPredictions/csvExport';
import { useModelFeedback } from '../hooks/useModelFeedback';
import ModelFeedbackSummary from '../model-feedback/components/ModelFeedbackSummary';
import ModelFeedbackTable from '../model-feedback/components/ModelFeedbackTable';
import {
  dateInputToRFC3339,
  feedbackCSVRows,
  filterFeedbackItems,
  modelLabel,
  type FeedbackVoteFilter,
} from '../model-feedback/modelFeedbackModel';

type ModelFeedbackSectionProps = {
  active: boolean;
  availableModels: GetInferenceAvailableModelsResponse[];
  // Saves the exported CSV; replaced in tests.
  saveFile?: (fileName: string, text: string) => void;
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

const inputClassName =
  'h-[35px] rounded-lg border border-white/20 bg-[#232823] px-3 text-sm text-white focus:border-[#6ED47C] focus:outline-none';

const ModelFeedbackSection = ({
  active,
  availableModels,
  saveFile = defaultSaveFile,
}: ModelFeedbackSectionProps) => {
  const { t } = useTranslation('ModelFeedback');
  const [model, setModel] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackVoteFilter>('');
  const [userSearch, setUserSearch] = useState('');

  const query = useMemo(
    () => ({
      model,
      from: dateInputToRFC3339(fromDate),
      to: dateInputToRFC3339(toDate, true),
    }),
    [model, fromDate, toDate]
  );
  const feedback = useModelFeedback({ active, query });
  const summary = useMemo(() => feedback.data?.summary ?? [], [feedback.data]);
  const items = useMemo(
    () => filterFeedbackItems(feedback.data?.items ?? [], { feedbackType, userSearch }),
    [feedback.data, feedbackType, userSearch]
  );
  const modelName = (inferenceModelId: string) => modelLabel(inferenceModelId, availableModels);

  // Models the admin can filter on: the available ones plus any that votes mention.
  const modelOptions = useMemo(() => {
    const ids = new Set<string>();
    availableModels.forEach(entry => entry.modelId && ids.add(entry.modelId));
    summary.forEach(entry => entry.inferenceModelId && ids.add(entry.inferenceModelId));
    if (model) {
      ids.add(model);
    }
    return Array.from(ids)
      .map(id => ({ id, label: modelLabel(id, availableModels) }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [availableModels, summary, model]);

  const voteLabel = (type: string) =>
    type?.toUpperCase() === 'APPROVE' ? t('Approved') : t('Rejected');

  const exportCSV = () => {
    const rows = feedbackCSVRows(items, {
      headers: {
        updatedAt: t('Updated at'),
        createdAt: t('Created at'),
        model: t('Model'),
        modelId: t('Model ID'),
        version: t('Version'),
        vote: t('Vote'),
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
    });
    const date = new Date().toISOString().slice(0, 10);
    saveFile(`model-feedback-${date}.csv`, serializeCSV(rows));
  };

  const hasData = !!feedback.data;

  return (
    <div data-testid="model-feedback-section">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl text-white">{t('Model Feedback')}</h1>
          <p className="text-sm text-white/60">
            {t('Thumbs up and down given by users on AI reports')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={feedback.loading}
            className="flex h-[35px] items-center gap-2 rounded-full bg-white bg-opacity-10 px-3"
            onClick={feedback.refresh}
            data-testid="model-feedback-refresh"
          >
            <img
              src={refreshIcon}
              alt="Refresh icon"
              className={`${feedback.loading ? 'animate-spin' : ''} h-4 w-4`}
            />
            <span className={`text-white ${feedback.loading ? 'opacity-40' : ''} text-[14px]`}>
              {t('Refresh')}
            </span>
          </button>
          <button
            type="button"
            disabled={!items.length}
            className="border-primary text-primary h-[35px] rounded-lg border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            onClick={exportCSV}
            data-testid="model-feedback-export"
          >
            {t('Export CSV')}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm text-white/80">
        <label className="flex flex-col gap-1">
          {t('Model')}
          <select
            className={inputClassName}
            value={model}
            onChange={event => setModel(event.target.value)}
            data-testid="model-feedback-model-filter"
          >
            <option value="">{t('All models')}</option>
            {modelOptions.map(option => (
              <option
                key={option.id}
                value={option.id}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('From')}
          <input
            type="date"
            className={inputClassName}
            value={fromDate}
            max={toDate || undefined}
            onChange={event => setFromDate(event.target.value)}
            data-testid="model-feedback-from"
          />
        </label>
        <label className="flex flex-col gap-1">
          {t('To')}
          <input
            type="date"
            className={inputClassName}
            value={toDate}
            min={fromDate || undefined}
            onChange={event => setToDate(event.target.value)}
            data-testid="model-feedback-to"
          />
        </label>
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
          <section className="mt-6">
            <h2 className="mb-3 text-base text-white">{t('Votes per model version')}</h2>
            {summary.length ? (
              <ModelFeedbackSummary
                summary={summary}
                modelName={modelName}
              />
            ) : (
              <p
                className="text-sm text-white/60"
                data-testid="model-feedback-empty"
              >
                {t('No feedback yet')}
              </p>
            )}
          </section>

          {summary.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-base text-white">{t('Votes')}</h2>
              {feedback.data?.truncated && (
                <p
                  className="mb-3 text-sm text-yellow-300"
                  data-testid="model-feedback-truncated"
                >
                  {t(
                    'Only the {{count}} most recent votes are listed; the counts above include every vote.',
                    { count: feedback.data.items.length }
                  )}
                </p>
              )}
              {items.length ? (
                <ModelFeedbackTable
                  items={items}
                  modelName={modelName}
                />
              ) : (
                <p className="text-sm text-white/60">{t('No vote matches the filters')}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ModelFeedbackSection;
