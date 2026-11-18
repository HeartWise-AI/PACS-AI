import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatActivity } from '../types';
import { formatDuration } from '../utils/activity';
import { ActivitySteps } from './ActivitySteps';

const thinkingDotsStyle: React.CSSProperties = {
  animation: 'thinking-dots 1.4s infinite ease-in-out',
  display: 'inline-block',
};

interface ThinkingIndicatorProps {
  // Live steps of the request in flight. Null or absent (older backend, progress
  // endpoint failing, nothing reported yet): the plain "Thinking..." is shown.
  activity?: ChatActivity | null;
  // When the request was sent, for the elapsed-seconds counter.
  startedAt?: Date;
}

const ThinkingDots: React.FC = () => (
  <>
    {[0, 1, 2].map(index => (
      <span
        key={index}
        className="thinking-dot ml-1"
        style={thinkingDotsStyle}
      >
        .
      </span>
    ))}
  </>
);

function useElapsedMilliseconds(startedAt: Date | undefined, enabled: boolean): number | null {
  const start = startedAt instanceof Date ? startedAt.getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled || Number.isNaN(start)) {
      return undefined;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled, start]);

  return enabled && !Number.isNaN(start) ? Math.max(0, now - start) : null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ activity, startedAt }) => {
  const { t } = useTranslation('ChatBox');
  const isLive = !!activity && Array.isArray(activity.steps);
  const elapsed = useElapsedMilliseconds(startedAt, isLive);
  const thinking = t('Thinking', { defaultValue: 'Thinking' });

  if (!isLive) {
    return (
      <div>
        {thinking}
        <ThinkingDots />
      </div>
    );
  }

  const steps = activity.steps;
  const isBetweenSteps = !steps.some(step => step.status === 'running');

  return (
    <div
      className="whitespace-normal"
      data-cy="chat-activity-live"
      aria-live="polite"
    >
      <ActivitySteps steps={steps} />
      <div className={`flex items-baseline justify-between ${steps.length ? 'mt-1' : ''}`}>
        <span>
          {isBetweenSteps && (
            <>
              {thinking}
              <ThinkingDots />
            </>
          )}
        </span>
        {elapsed !== null && (
          <span
            className="pl-3 text-xs opacity-60"
            data-cy="chat-activity-elapsed"
          >
            {formatDuration(Math.max(1000, elapsed), t)}
          </span>
        )}
      </div>
    </div>
  );
};
