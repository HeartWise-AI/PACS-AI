import React from 'react';
import { Icons } from '@ohif/ui-next';
import type { StudyProcessingSummary } from './types';
import {
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
  const presentation = getStudyProcessingStatusPresentation(summary);
  const progress = getStudyProcessingProgress(summary);
  const classNames = toneClassNames[presentation.tone];
  const hasModelPlan = summary.expectedModels > 0;
  const accessibleProgress = hasModelPlan
    ? `${summary.completedModels} of ${summary.expectedModels} models complete`
    : 'Model plan pending';

  return (
    <div
      className="min-w-[208px]"
      aria-label={`${presentation.label}. ${accessibleProgress}${
        summary.attentionRequired ? '. Processing requires attention' : ''
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
          {presentation.label}
        </span>

        {hasModelPlan && (
          <span className="whitespace-nowrap text-xs font-semibold text-white/60">
            {summary.completedModels} / {summary.expectedModels} models
          </span>
        )}

        {summary.attentionRequired && (
          <span
            className="ml-auto inline-flex"
            aria-label="Processing requires attention"
            title="Processing requires attention"
            data-testid="study-processing-attention"
          >
            <Icons.StatusWarning
              className="h-5 w-5"
              aria-hidden="true"
            />
          </span>
        )}
      </div>

      {hasModelPlan && (
        <div
          className="mt-2 h-[6px] w-[208px] overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Completed models"
          aria-valuemin={0}
          aria-valuemax={summary.expectedModels}
          aria-valuenow={Math.min(Math.max(summary.completedModels, 0), summary.expectedModels)}
        >
          <div
            className={`h-full rounded-full ${classNames.progress}`}
            style={{ width: `${progress}%` }}
            data-testid="study-processing-progress-fill"
          />
        </div>
      )}
    </div>
  );
}

export default StudyProcessingStatusCell;
