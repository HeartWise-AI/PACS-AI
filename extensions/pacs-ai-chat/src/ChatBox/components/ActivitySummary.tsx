import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatActivity } from '../types';
import { countTools, formatDuration, totalDuration } from '../utils/activity';
import { ActivitySteps } from './ActivitySteps';

interface ActivitySummaryProps {
  activity: ChatActivity;
}

/**
 * "Used 5 tools · 58 s" under a finished answer; collapsed by default, expands
 * to the step list with per-step durations.
 */
export const ActivitySummary: React.FC<ActivitySummaryProps> = ({ activity }) => {
  const { t } = useTranslation('ChatBox');
  const [isOpen, setIsOpen] = useState(false);

  const steps = Array.isArray(activity?.steps) ? activity.steps : [];
  if (steps.length === 0) {
    return null;
  }

  const count = countTools(activity);
  const used =
    count === 1
      ? t('ActivityUsedOneTool', { defaultValue: 'Used 1 tool' })
      : t('ActivityUsedTools', { count, defaultValue: `Used ${count} tools` });
  const duration = formatDuration(totalDuration(activity), t);
  const failed = steps.filter(step => step.status === 'failed').length;

  return (
    <div
      className="mt-2 border-t border-white border-opacity-10 pt-1 text-xs"
      data-cy="chat-activity-summary"
    >
      <button
        type="button"
        className="flex w-full items-center gap-1 text-left opacity-70 transition-opacity hover:opacity-100"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
      >
        <span
          aria-hidden="true"
          className="inline-block w-3 flex-shrink-0 text-center"
        >
          {isOpen ? '▾' : '▸'}
        </span>
        <span>
          {used}
          {duration && ` · ${duration}`}
        </span>
        {failed > 0 && (
          <span className="text-red-400">
            {' · '}
            {failed === 1
              ? t('ActivityOneFailed', { defaultValue: '1 failed' })
              : t('ActivitySomeFailed', { count: failed, defaultValue: `${failed} failed` })}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="mt-1">
          <ActivitySteps
            steps={steps}
            showDurations
          />
        </div>
      )}
    </div>
  );
};
