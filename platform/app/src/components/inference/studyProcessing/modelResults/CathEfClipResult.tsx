import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CathEfClipResultPayload } from './cathEfClipContract';

export interface CathEfClipResultProps {
  payload: CathEfClipResultPayload;
}

export function CathEfClipResult({ payload }: CathEfClipResultProps) {
  const { t, i18n } = useTranslation('StudyList');
  const percentage = new Intl.NumberFormat(i18n?.language, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const lvef = new Intl.NumberFormat(i18n?.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const reducedEf = payload.predictions.reducedEF;

  return (
    <section
      aria-labelledby="cathef-clip-title"
      data-testid="cathef-clip-result"
    >
      <header className="mb-4">
        <h3
          id="cathef-clip-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingCathEfClipTitle', { defaultValue: 'CathEF-CLIP LVEF estimate' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingCathEfClipDescription', {
            defaultValue:
              'Model-generated LVEF estimate and reduced-EF classification from a left-coronary angiogram.',
          })}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <section
          className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
          aria-labelledby="cathef-clip-lvef-label"
        >
          <h4
            id="cathef-clip-lvef-label"
            className="text-xs font-semibold text-[#c5cbc5]"
          >
            {t('ProcessingCathEfClipLvef', { defaultValue: 'Estimated LVEF' })}
          </h4>
          <p
            className="mt-2 text-3xl font-bold tabular-nums text-white"
            data-testid="cathef-clip-lvef"
          >
            {lvef.format(payload.predictions.LVEF.value)}%
          </p>
        </section>

        <section
          className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
          aria-labelledby="cathef-clip-classification-label"
        >
          <h4
            id="cathef-clip-classification-label"
            className="text-xs font-semibold text-[#c5cbc5]"
          >
            {t('ProcessingCathEfClipClassification', { defaultValue: 'EF classification' })}
          </h4>
          <p
            className="mt-2 text-lg font-bold text-white"
            data-testid="cathef-clip-classification"
          >
            {reducedEf.diagnosis === 'reduced'
              ? t('ProcessingCathEfClipReduced', { defaultValue: 'Reduced EF' })
              : t('ProcessingCathEfClipPreserved', { defaultValue: 'Preserved EF' })}
          </p>
        </section>
      </div>

      <dl className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[#c5cbc5]">
            {t('ProcessingCathEfClipProbability', { defaultValue: 'Reduced-EF probability' })}
          </dt>
          <dd className="mt-1 font-semibold tabular-nums text-white">
            {percentage.format(reducedEf.probability)}
          </dd>
        </div>
        <div>
          <dt className="text-[#c5cbc5]">
            {t('ProcessingCathEfClipThreshold', { defaultValue: 'Research threshold' })}
          </dt>
          <dd className="mt-1 font-semibold tabular-nums text-white">
            {percentage.format(reducedEf.threshold)}
          </dd>
        </div>
      </dl>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="cathef-clip-assistive-note"
      >
        {t('ProcessingCathEfClipAssistiveNote', {
          defaultValue:
            'AI-generated estimate from coronary angiography. Confirm ventricular function with the complete study, appropriate cardiac imaging, and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default CathEfClipResult;
