import React from 'react';
import { Icons } from '@ohif/ui-next';
import { useTranslation } from 'react-i18next';
import { useStudyProcessing } from './StudyProcessingProvider';

export interface StudyProcessingAttentionProps {
  studyInstanceUID: string;
}

export function StudyProcessingAttention({ studyInstanceUID }: StudyProcessingAttentionProps) {
  const { t } = useTranslation('StudyList');
  const { getStudySummary } = useStudyProcessing();
  const summary = getStudySummary(studyInstanceUID);

  if (!summary?.attentionRequired) {
    return null;
  }

  const attentionLabel = t('ProcessingRequiresAttention', {
    defaultValue: 'Processing requires attention',
  });
  const warningCount = summary.attentionReasons.length;
  const warningCountLabel =
    warningCount === 1
      ? t('ProcessingAttentionSingleWarning', {
          defaultValue: '1 processing warning',
        })
      : t('ProcessingAttentionMultipleWarnings', {
          count: warningCount,
          defaultValue: '{{count}} processing warnings',
        });

  return (
    <div
      className="mb-4 flex min-h-[44px] items-center gap-3 rounded-md border border-[#facc15]/30 bg-[#facc15]/10 px-4 text-[#facc15]"
      role="status"
      aria-label={`${attentionLabel}. ${warningCountLabel}`}
      data-testid="study-processing-attention-banner"
    >
      <Icons.StatusWarning
        className="h-5 w-5 shrink-0"
        aria-hidden="true"
      />
      <span className="text-sm font-semibold">{attentionLabel}</span>
      <span className="text-xs text-white/70">{warningCountLabel}</span>
    </div>
  );
}

export default StudyProcessingAttention;
