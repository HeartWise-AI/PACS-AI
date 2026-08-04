import React from 'react';
import { Icons } from '@ohif/ui-next';
import { useTranslation } from 'react-i18next';
import type { StudyProcessingSummary } from './types';
import {
  getStudyProcessingStatusPresentation,
  type StudyProcessingStatusTone,
} from './statusPresentation';

const toneClassNames: Record<StudyProcessingStatusTone, string> = {
  waiting: 'text-[#9ca3af]',
  retrieving: 'text-[#a78bfa]',
  queued: 'text-[#94a3b8]',
  processing: 'text-[#60a5fa]',
  completed: 'text-[#4ade80]',
  partial: 'text-[#facc15]',
  failed: 'text-[#f87171]',
  cancelled: 'text-[#7c8b9a]',
};

export interface StudyProcessingStatusCellProps {
  summary: StudyProcessingSummary;
}

export function StudyProcessingStatusCell({ summary }: StudyProcessingStatusCellProps) {
  const { t } = useTranslation('StudyList');
  const presentation = getStudyProcessingStatusPresentation(summary);
  const statusLabel = t(presentation.translationKey, {
    defaultValue: presentation.label,
  });
  const toneClassName = toneClassNames[presentation.tone];
  const hasModelPlan = summary.expectedModels > 0;
  const completedModels = hasModelPlan
    ? Math.min(Math.max(summary.completedModels, 0), summary.expectedModels)
    : 0;
  const accessibleProgress = hasModelPlan
    ? t('ProcessingModelCount', {
        completed: completedModels,
        expected: summary.expectedModels,
        defaultValue: '{{completed}} of {{expected}} models',
      })
    : t('ProcessingModelPlanPending', {
        defaultValue: 'Model plan pending',
      });
  const attentionLabel = t('ProcessingRequiresAttention', {
    defaultValue: 'Processing requires attention',
  });

  return (
    <div
      className="min-w-[208px]"
      aria-label={`${statusLabel}. ${accessibleProgress}${
        summary.attentionRequired ? `. ${attentionLabel}` : ''
      }`}
      data-testid="study-processing-status-cell"
    >
      <div className="flex items-start gap-3">
        <div>
          <span
            className={`block text-sm font-medium ${toneClassName}`}
            data-testid="study-processing-status-label"
          >
            {statusLabel}
          </span>

          {hasModelPlan && (
            <span
              className="mt-0.5 block whitespace-nowrap text-xs text-[#9ca3af]"
              role="progressbar"
              aria-label={t('ProcessingCompletedModels', {
                defaultValue: 'Completed models',
              })}
              aria-valuemin={0}
              aria-valuemax={summary.expectedModels}
              aria-valuenow={completedModels}
              data-testid="study-processing-model-count"
            >
              {accessibleProgress}
            </span>
          )}
        </div>

        {summary.attentionRequired && (
          <span
            className="ml-auto inline-flex pt-0.5"
            aria-label={attentionLabel}
            title={attentionLabel}
            data-testid="study-processing-attention"
          >
            <Icons.StatusWarning
              className="h-5 w-5"
              aria-hidden="true"
            />
          </span>
        )}
      </div>
    </div>
  );
}

export default StudyProcessingStatusCell;
