import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ModelFeedbackListItem } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import { feedbackUserLabel, formatFeedbackAnswers } from '../modelFeedbackModel';

type ModelFeedbackTableProps = {
  items: ModelFeedbackListItem[];
  modelName: (inferenceModelId: string) => string;
};

/** One row per vote: date, model, version, vote, user, run and answers. */
const ModelFeedbackTable = ({ items, modelName }: ModelFeedbackTableProps) => {
  const { t } = useTranslation('ModelFeedback');

  return (
    <div className="ohif-scrollbar overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm text-white">
        <thead className="text-white/60">
          <tr className="border-b border-white/10">
            <th className="px-3 py-2 font-normal">{t('Date')}</th>
            <th className="px-3 py-2 font-normal">{t('Model')}</th>
            <th className="px-3 py-2 font-normal">{t('Version')}</th>
            <th className="px-3 py-2 font-normal">{t('Vote')}</th>
            <th className="px-3 py-2 font-normal">{t('User')}</th>
            <th className="px-3 py-2 font-normal">{t('Run ID')}</th>
            <th className="px-3 py-2 font-normal">{t('Answers')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const approved = item.feedbackType?.toUpperCase() === 'APPROVE';
            return (
              <tr
                key={item.id}
                className="border-b border-white/5 align-top"
                data-testid="model-feedback-row"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  {item.updatedAt ? new Date(item.updatedAt * 1000).toLocaleString() : ''}
                </td>
                <td className="px-3 py-2">{modelName(item.inferenceModelId)}</td>
                <td className="px-3 py-2">{item.modelVersion}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      approved ? 'bg-[#6ED47C]/20 text-[#6ED47C]' : 'bg-[#F87171]/20 text-[#F87171]'
                    }`}
                  >
                    {approved ? t('Approved') : t('Rejected')}
                  </span>
                </td>
                <td
                  className="px-3 py-2"
                  title={item.userEmail ?? undefined}
                >
                  {feedbackUserLabel(item)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{item.runId || '—'}</td>
                <td className="max-w-[360px] whitespace-pre-wrap break-words px-3 py-2 text-white/80">
                  {formatFeedbackAnswers(item.answers) || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ModelFeedbackTable;
