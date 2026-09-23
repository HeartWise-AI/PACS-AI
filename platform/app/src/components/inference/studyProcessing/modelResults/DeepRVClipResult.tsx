import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DeepRVClipDiagnosis, DeepRVClipResultPayload } from './deepRVClipContract';

export interface DeepRVClipResultProps {
  payload: DeepRVClipResultPayload;
}

const diagnosisTranslation: Record<
  DeepRVClipDiagnosis,
  { key: string; defaultValue: string; tone: string }
> = {
  normal: {
    key: 'ProcessingDeepRVClipDiagnosisNormal',
    defaultValue: 'Normal RV systolic function',
    tone: 'text-[#4ade80]',
  },
  abnormal: {
    key: 'ProcessingDeepRVClipDiagnosisAbnormal',
    defaultValue: 'Possible RV systolic dysfunction',
    tone: 'text-[#facc15]',
  },
};

function formatPercentage(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function DeepRVClipResult({ payload }: DeepRVClipResultProps) {
  const { t, i18n } = useTranslation('StudyList');
  const prediction = payload.predictions.abnormalRV;
  const diagnosis = diagnosisTranslation[prediction.diagnosis];
  const locale = i18n?.language;

  return (
    <section
      aria-labelledby="deeprv-clip-result-title"
      data-testid="deeprv-clip-result"
    >
      <header className="mb-4">
        <h3
          id="deeprv-clip-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingDeepRVClipTitle', {
            defaultValue: 'DeepRV-CLIP right ventricular function',
          })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingDeepRVClipDescription', {
            defaultValue:
              'Model-estimated right ventricular systolic function from coronary angiography.',
          })}
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepRVClipStatus', { defaultValue: 'RV systolic function' })}
          </dt>
          <dd
            className={`mt-3 text-base font-bold ${diagnosis.tone}`}
            data-testid="deeprv-clip-diagnosis"
          >
            {t(diagnosis.key, { defaultValue: diagnosis.defaultValue })}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepRVClipProbability', {
              defaultValue: 'Abnormal RV probability',
            })}
          </dt>
          <dd
            className="mt-3 text-2xl font-bold tabular-nums text-white"
            data-testid="deeprv-clip-probability"
          >
            {formatPercentage(prediction.probability, locale)}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepRVClipThreshold', { defaultValue: 'Decision threshold' })}
          </dt>
          <dd
            className="mt-3 text-2xl font-bold tabular-nums text-white"
            data-testid="deeprv-clip-threshold"
          >
            {formatPercentage(prediction.threshold, locale)}
          </dd>
        </div>
      </dl>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="deeprv-clip-assistive-note"
      >
        {t('ProcessingDeepRVClipAssistiveNote', {
          defaultValue:
            'AI-generated estimate of right ventricular systolic function. Review the complete angiographic study and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default DeepRVClipResult;
