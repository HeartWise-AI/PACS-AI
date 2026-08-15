import React from 'react';
import { useTranslation } from 'react-i18next';
import TopNavigation from '../../components/TopNavigation';
import { useStudyProcessing } from '../../components/inference/studyProcessing';

export interface WorklistTopNavigationProps {
  fixturePreview: boolean;
}

export function WorklistTopNavigation({ fixturePreview }: WorklistTopNavigationProps) {
  const { t } = useTranslation('StudyList');
  const { realtimeConnectionStatus } = useStudyProcessing();
  const connectionIsHealthy = fixturePreview || realtimeConnectionStatus === 'connected';
  const connectionLabel = fixturePreview
    ? t('ProcessingFixtureConnected', { defaultValue: 'Fixture data connected' })
    : t('ProcessingLiveConnection', { defaultValue: 'Live processing connected' });

  const processingAccessory = fixturePreview ? (
    <div className="hidden items-center gap-2 lg:flex">
      <div
        className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${
          connectionIsHealthy
            ? 'border-[#4ade80]/35 bg-[#4ade80]/15 text-[#4ade80]'
            : 'border-[#facc15]/35 bg-[#facc15]/15 text-[#facc15]'
        }`}
        role="status"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            connectionIsHealthy ? 'bg-[#4ade80]' : 'bg-[#facc15]'
          }`}
          aria-hidden="true"
        />
        {connectionLabel}
      </div>
      <span className="border-white/15 rounded-full border bg-white/5 px-3 py-1 font-mono text-[10px] text-white/50">
        realtimeWorklist
      </span>
    </div>
  ) : undefined;

  return (
    <TopNavigation
      title="Studies"
      accessory={processingAccessory}
    />
  );
}

export default WorklistTopNavigation;
