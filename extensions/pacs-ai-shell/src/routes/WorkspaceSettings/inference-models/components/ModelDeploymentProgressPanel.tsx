import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrackedModelDeployment } from '../modelDeployment';
import {
  formatDeploymentElapsed,
  MODEL_DEPLOYMENT_STAGE_LABELS,
  MODEL_DEPLOYMENT_STATUS_LABELS,
} from '../modelDeployment';

type ModelDeploymentProgressPanelProps = {
  deployment: TrackedModelDeployment;
};

const stages = Object.keys(MODEL_DEPLOYMENT_STAGE_LABELS);

const statusStyles = {
  PENDING: 'bg-white bg-opacity-10 text-white text-opacity-80',
  RUNNING: 'bg-blue-400 bg-opacity-15 text-blue-200',
  COMPLETED: 'bg-[#C8F469] bg-opacity-15 text-[#C8F469]',
  FAILED: 'bg-red-500 bg-opacity-15 text-red-300',
  ROLLED_BACK: 'bg-amber-400 bg-opacity-15 text-amber-200',
  INTERRUPTED: 'bg-amber-400 bg-opacity-15 text-amber-200',
};

const ModelDeploymentProgressPanel = ({ deployment }: ModelDeploymentProgressPanelProps) => {
  const { t } = useTranslation('Common');
  const [now, setNow] = useState(Date.now());
  const { progress, connectionMode } = deployment;

  useEffect(() => {
    if (progress.terminal) {
      return undefined;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [progress.terminal]);

  const elapsedMilliseconds = progress.terminal
    ? progress.elapsedMilliseconds
    : progress.elapsedMilliseconds + Math.max(0, now - progress.timestamp);
  const activeStageIndex = stages.indexOf(progress.stage);
  const errorMessage = progress.rollbackError || progress.errorMessage;

  return (
    <div
      className="mt-5 border-y border-white border-opacity-10 py-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">
            {t(MODEL_DEPLOYMENT_STAGE_LABELS[progress.stage])}
          </p>
          <p className="text-opacity-55 mt-1 text-xs text-white">
            {t('Elapsed')}: {formatDeploymentElapsed(elapsedMilliseconds)}
            {!progress.terminal && (
              <>
                {' · '}
                {connectionMode === 'live' ? t('Live updates') : t('Reconnecting')}
              </>
            )}
          </p>
        </div>
        <span className={`rounded px-2 py-1 text-xs font-medium ${statusStyles[progress.status]}`}>
          {t(MODEL_DEPLOYMENT_STATUS_LABELS[progress.status])}
        </span>
      </div>

      <div
        className="mt-4 grid grid-cols-8 gap-1"
        aria-hidden="true"
      >
        {stages.map((stage, index) => (
          <span
            key={stage}
            className={`h-1 rounded-sm ${
              index <= activeStageIndex ? 'bg-[#C8F469]' : 'bg-white bg-opacity-10'
            }`}
          />
        ))}
      </div>

      {errorMessage && (
        <p className="mt-3 border-l-2 border-red-400 pl-3 text-sm text-red-200">{errorMessage}</p>
      )}
    </div>
  );
};

export default ModelDeploymentProgressPanel;
