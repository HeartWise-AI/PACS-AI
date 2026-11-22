import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DeepRVClass, DeepRVResultPayload } from './deepRVContract';

export interface DeepRVResultProps {
  payload: DeepRVResultPayload;
}

const classTranslation: Record<DeepRVClass, { key: string; defaultValue: string; tone: string }> = {
  0: {
    key: 'ProcessingDeepRVDiagnosisNormal',
    defaultValue: 'Normal RV systolic function',
    tone: 'text-[#4ade80]',
  },
  1: {
    key: 'ProcessingDeepRVDiagnosisReduced',
    defaultValue: 'Reduced RV systolic function',
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

export function DeepRVResult({ payload }: DeepRVResultProps) {
  const { t, i18n } = useTranslation('StudyList');
  const prediction = payload.predictions;
  const presentation = classTranslation[prediction.class];

  return (
    <section
      aria-labelledby="deeprv-result-title"
      data-testid="deeprv-result"
    >
      <header className="mb-4">
        <h3
          id="deeprv-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingDeepRVTitle', { defaultValue: 'DeepRV right ventricular function' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingDeepRVDescription', {
            defaultValue:
              'Model-estimated right ventricular systolic function from coronary angiography.',
          })}
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepRVStatus', { defaultValue: 'RV systolic function' })}
          </dt>
          <dd
            className={`mt-3 text-base font-bold ${presentation.tone}`}
            data-testid="deeprv-diagnosis"
          >
            {t(presentation.key, { defaultValue: presentation.defaultValue })}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepRVProbability', { defaultValue: 'Reduced RV probability' })}
          </dt>
          <dd
            className="mt-3 text-2xl font-bold tabular-nums text-white"
            data-testid="deeprv-probability"
          >
            {formatPercentage(prediction.probability, i18n?.language)}
          </dd>
        </div>
      </dl>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="deeprv-assistive-note"
      >
        {t('ProcessingDeepRVAssistiveNote', {
          defaultValue:
            'AI-generated estimate of right ventricular systolic function. Review the complete angiographic study and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default DeepRVResult;
