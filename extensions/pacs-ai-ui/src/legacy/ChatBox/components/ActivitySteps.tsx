import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatActivityStep } from '../types';
import { formatDuration, stepLabel } from '../utils/activity';

const runningDotStyle: React.CSSProperties = {
  animation: 'thinking-dots 1.4s infinite ease-in-out',
  display: 'inline-block',
};

interface ActivityStepsProps {
  steps: ChatActivityStep[];
  // Per-step durations are shown on a finished answer, not while thinking.
  showDurations?: boolean;
}

const StepMark: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation('ChatBox');
  if (status === 'running') {
    return (
      <span
        className="thinking-dot w-3 flex-shrink-0 text-center text-[#C8F469]"
        style={runningDotStyle}
        role="img"
        aria-label={t('ActivityStepRunning', { defaultValue: 'In progress' })}
      >
        ●
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="w-3 flex-shrink-0 text-center text-red-400"
        role="img"
        aria-label={t('ActivityStepFailed', { defaultValue: 'Failed' })}
      >
        ✕
      </span>
    );
  }
  return (
    <span
      className="w-3 flex-shrink-0 text-center text-[#C8F469]"
      role="img"
      aria-label={t('ActivityStepDone', { defaultValue: 'Done' })}
    >
      ✓
    </span>
  );
};

/** Ordered list of what the assistant used: check, failure mark or live indicator per step. */
export const ActivitySteps: React.FC<ActivityStepsProps> = ({ steps, showDurations = false }) => {
  const { t } = useTranslation('ChatBox');

  return (
    <ul
      className="m-0 list-none space-y-0.5 p-0 text-xs"
      data-cy="chat-activity-steps"
    >
      {steps.map(step => {
        const duration = showDurations ? formatDuration(step.duration_ms, t) : '';
        return (
          <li
            key={step.id}
            className="flex items-baseline gap-1.5 whitespace-normal"
            data-status={step.status}
          >
            <StepMark status={step.status} />
            <span className={step.status === 'running' ? 'opacity-100' : 'opacity-80'}>
              {stepLabel(step, t)}
              {step.status === 'failed' && (
                <span className="ml-1 text-red-400">
                  {t('ActivityStepFailedSuffix', { defaultValue: '(failed)' })}
                </span>
              )}
            </span>
            {duration && <span className="ml-auto flex-shrink-0 pl-2 opacity-60">{duration}</span>}
          </li>
        );
      })}
    </ul>
  );
};
