import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelFeedbackSummaryEntry } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import { approvalRatio } from '../modelFeedbackModel';

type ModelFeedbackSummaryProps = {
  summary: ModelFeedbackSummaryEntry[];
  modelName: (inferenceModelId: string) => string;
};

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

/** Approve and reject counts per model version, with a two-segment ratio bar. */
const ModelFeedbackSummary = ({ summary, modelName }: ModelFeedbackSummaryProps) => {
  const { t } = useTranslation('ModelFeedback');

  if (!summary.length) {
    return null;
  }

  return (
    <ul
      className="flex flex-col gap-3"
      aria-label={t('Votes per model version')}
    >
      {summary.map(entry => {
        const ratio = approvalRatio(entry);
        const approveWidth = ratio === null ? '0%' : percent(ratio);
        const rejectWidth = ratio === null ? '0%' : percent(1 - ratio);
        return (
          <li
            key={entry.modelId}
            className="grid grid-cols-1 items-center gap-2 text-sm text-white sm:grid-cols-[minmax(180px,1.2fr)_minmax(160px,0.8fr)_minmax(200px,2fr)]"
            data-testid="model-feedback-summary-row"
          >
            <div className="min-w-0">
              <span className="font-semibold">{modelName(entry.inferenceModelId)}</span>
              {entry.version && <span className="ml-2 text-white/60">v{entry.version}</span>}
            </div>
            <div className="flex gap-3 text-white/80">
              <span data-testid="model-feedback-approve-count">
                {t('{{count}} approved', { count: entry.approveCount })}
              </span>
              <span data-testid="model-feedback-reject-count">
                {t('{{count}} rejected', { count: entry.rejectCount })}
              </span>
            </div>
            <div
              role="img"
              aria-label={
                ratio === null
                  ? t('No votes')
                  : t('{{approve}} approved, {{reject}} rejected ({{percent}} approved)', {
                      approve: entry.approveCount,
                      reject: entry.rejectCount,
                      percent: percent(ratio),
                    })
              }
              className="flex h-3 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full bg-[#6ED47C]"
                style={{ width: approveWidth }}
                data-testid="model-feedback-approve-bar"
              />
              <div
                className="h-full bg-[#F87171]"
                style={{ width: rejectWidth }}
                data-testid="model-feedback-reject-bar"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default ModelFeedbackSummary;
