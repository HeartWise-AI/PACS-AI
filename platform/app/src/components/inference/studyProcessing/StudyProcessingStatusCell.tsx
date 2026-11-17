import React from 'react';
import { Icons } from '@ohif/ui-next';
import { useTranslation } from 'react-i18next';
import type { StudyProcessingSummary } from './types';
import {
  getStudyProcessingActivityPresentation,
  getStudyProcessingProgress,
  getStudyProcessingStatusPresentation,
  type StudyProcessingStatusTone,
} from './statusPresentation';

const toneClassNames: Record<
  StudyProcessingStatusTone,
  { badge: string; dot: string; progress: string }
> = {
  waiting: {
    badge: 'border-[#9ca3af]/35 bg-[#9ca3af]/15 text-[#9ca3af]',
    dot: 'bg-[#9ca3af]',
    progress: 'bg-[#9ca3af]',
  },
  retrieving: {
    badge: 'border-[#a78bfa]/35 bg-[#a78bfa]/15 text-[#a78bfa]',
    dot: 'bg-[#a78bfa]',
    progress: 'bg-[#a78bfa]',
  },
  queued: {
    badge: 'border-[#94a3b8]/35 bg-[#94a3b8]/15 text-[#94a3b8]',
    dot: 'bg-[#94a3b8]',
    progress: 'bg-[#94a3b8]',
  },
  processing: {
    badge: 'border-[#60a5fa]/35 bg-[#60a5fa]/15 text-[#60a5fa]',
    dot: 'bg-[#60a5fa]',
    progress: 'bg-[#60a5fa]',
  },
  completed: {
    badge: 'border-[#4ade80]/35 bg-[#4ade80]/15 text-[#4ade80]',
    dot: 'bg-[#4ade80]',
    progress: 'bg-[#4ade80]',
  },
  partial: {
    badge: 'border-[#facc15]/35 bg-[#facc15]/15 text-[#facc15]',
    dot: 'bg-[#facc15]',
    progress: 'bg-[#facc15]',
  },
  failed: {
    badge: 'border-[#f87171]/35 bg-[#f87171]/15 text-[#f87171]',
    dot: 'bg-[#f87171]',
    progress: 'bg-[#f87171]',
  },
  cancelled: {
    badge: 'border-[#7c8b9a]/35 bg-[#7c8b9a]/15 text-[#7c8b9a]',
    dot: 'bg-[#7c8b9a]',
    progress: 'bg-[#7c8b9a]',
  },
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
  const activityPresentation = getStudyProcessingActivityPresentation(summary);
  const activityLabel = t(activityPresentation.translationKey, {
    runNumber: summary.runNumber,
    activeModels: summary.activeModels,
    defaultValue: activityPresentation.label,
  });
  const classNames = toneClassNames[presentation.tone];
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
  const compactProgress = hasModelPlan
    ? t('ProcessingModelCountCompact', {
        completed: completedModels,
        expected: summary.expectedModels,
        defaultValue: '{{completed}} / {{expected}} models',
      })
    : null;
  const progress = getStudyProcessingProgress(summary);
  const attentionLabel = t('ProcessingRequiresAttention', {
    defaultValue: 'Processing requires attention',
  });

  return (
    <div
      className="min-w-[360px]"
      aria-label={`${statusLabel}. ${accessibleProgress}${
        summary.attentionRequired ? `. ${attentionLabel}` : ''
      }`}
      data-testid="study-processing-status-cell"
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-[22px] items-center gap-2 rounded-full border px-3 text-xs font-semibold ${classNames.badge}`}
          data-testid="study-processing-status-badge"
        >
          <span
            className={`h-[7px] w-[7px] rounded-full ${classNames.dot}`}
            aria-hidden="true"
          />
          <span data-testid="study-processing-status-label">{statusLabel}</span>
        </span>

        {compactProgress && (
          <span
            className="whitespace-nowrap text-xs font-semibold text-[#d1d5db]"
            data-testid="study-processing-model-count"
          >
            {compactProgress}
          </span>
        )}

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

      <div className="mt-2 flex items-center gap-4">
        {hasModelPlan && (
          <div
            className="h-[6px] w-[208px] shrink-0 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label={t('ProcessingCompletedModels', {
              defaultValue: 'Completed models',
            })}
            aria-valuemin={0}
            aria-valuemax={summary.expectedModels}
            aria-valuenow={completedModels}
          >
            <div
              className={`h-full rounded-full ${classNames.progress}`}
              style={{ width: `${progress}%` }}
              data-testid="study-processing-progress-fill"
            />
          </div>
        )}
        <span className="truncate text-xs text-[#b8c0b8]">{activityLabel}</span>
      </div>
    </div>
  );
}

export default StudyProcessingStatusCell;
