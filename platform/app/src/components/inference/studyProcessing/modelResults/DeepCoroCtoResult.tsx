import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEEP_CORO_CTO_ARTERIES,
  DEEP_CORO_CTO_COMPONENTS,
  type DeepCoroCtoComponentKey,
  type DeepCoroCtoResultPayload,
} from './deepCoroCtoContract';

export interface DeepCoroCtoResultProps {
  payload: DeepCoroCtoResultPayload;
}

const componentLabels: Record<DeepCoroCtoComponentKey, [string, string]> = {
  jcto_blunt_stump: ['ProcessingDeepCoroCtoBluntStump', 'Blunt or flush stump'],
  jcto_calcification: ['ProcessingDeepCoroCtoCalcification', 'Calcification at occlusion'],
  jcto_bending_gt45: ['ProcessingDeepCoroCtoBending', 'Bending greater than 45°'],
  jcto_occlusion_length_gt20: [
    'ProcessingDeepCoroCtoOcclusionLength',
    'Occlusion length at least 20 mm',
  ],
};

export function DeepCoroCtoResult({ payload }: DeepCoroCtoResultProps) {
  const { t, i18n } = useTranslation('StudyList');
  const { jctoScore, components, ctoArtery, perArtery } = payload.predictions;
  const percentage = new Intl.NumberFormat(i18n?.language, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section
      aria-labelledby="deepcoro-cto-title"
      data-testid="deepcoro-cto-result"
    >
      <header className="mb-4">
        <h3
          id="deepcoro-cto-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingDeepCoroCtoTitle', { defaultValue: 'DeepCORO-CTO J-CTO assessment' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingDeepCoroCtoDescription', {
            defaultValue:
              'Model-estimated imaging J-CTO score and morphology components by coronary artery.',
          })}
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepCoroCtoSelectedArtery', { defaultValue: 'Selected CTO artery' })}
          </dt>
          <dd className="mt-3 text-2xl font-bold text-white">{ctoArtery}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepCoroCtoScore', { defaultValue: 'Imaging J-CTO score' })}
          </dt>
          <dd className="mt-3 text-2xl font-bold tabular-nums text-white">
            {jctoScore.predictedInteger}
            <span className="ml-2 text-xs font-normal text-[#c5cbc5]">
              ({t('ProcessingDeepCoroCtoRaw', { defaultValue: 'raw' })}{' '}
              {jctoScore.predicted.toFixed(1)})
            </span>
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepCoroCtoDifficulty', { defaultValue: 'Difficulty band' })}
          </dt>
          <dd className="mt-3 text-lg font-bold capitalize text-white">{jctoScore.difficulty}</dd>
          <dd className="mt-1 text-xs text-[#78b7f5]">
            {jctoScore.componentsAboveThreshold}/4{' '}
            {t('ProcessingDeepCoroCtoComponentsPresent', {
              defaultValue: 'components above threshold',
            })}
          </dd>
        </div>
      </dl>

      {ctoArtery === 'LCx' && (
        <p
          className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100"
          role="note"
          data-testid="deepcoro-cto-lcx-warning"
        >
          {t('ProcessingDeepCoroCtoLcxWarning', {
            defaultValue:
              'Caution: LCx predictions are unreliable because the model was validated on very few LCx CTO cases.',
          })}
        </p>
      )}

      <section
        className="mt-5"
        aria-labelledby="deepcoro-cto-components-title"
      >
        <h4
          id="deepcoro-cto-components-title"
          className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
        >
          {t('ProcessingDeepCoroCtoComponents', { defaultValue: 'J-CTO morphology components' })}
        </h4>
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]">
          <table className="min-w-[660px] table-fixed border-collapse text-left">
            <thead>
              <tr className="text-xs text-[#c5cbc5]">
                <th
                  className="w-[40%] px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroCtoComponent', { defaultValue: 'Component' })}
                </th>
                <th
                  className="w-[20%] px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroCtoProbability', { defaultValue: 'Probability' })}
                </th>
                <th
                  className="w-[20%] px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroCtoThreshold', { defaultValue: 'Threshold' })}
                </th>
                <th
                  className="w-[20%] px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroCtoState', { defaultValue: 'State' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {DEEP_CORO_CTO_COMPONENTS.map(key => {
                const component = components[key];
                const [labelKey, label] = componentLabels[key];
                return (
                  <tr
                    key={key}
                    data-testid={`deepcoro-cto-component-${key}`}
                  >
                    <th
                      className="border-t border-white/10 px-3 py-3 text-xs text-white"
                      scope="row"
                    >
                      {t(labelKey, { defaultValue: label })}
                    </th>
                    <td className="border-t border-white/10 px-3 py-3 text-xs tabular-nums text-white">
                      {percentage.format(component.probability)}
                    </td>
                    <td className="border-t border-white/10 px-3 py-3 text-xs tabular-nums text-[#c5cbc5]">
                      {percentage.format(component.threshold)}
                    </td>
                    <td className="border-t border-white/10 px-3 py-3 text-xs font-semibold text-white">
                      {component.present
                        ? t('ProcessingDeepCoroCtoPresent', { defaultValue: 'Present' })
                        : t('ProcessingDeepCoroCtoAbsent', { defaultValue: 'Not present' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="mt-5"
        aria-labelledby="deepcoro-cto-arteries-title"
      >
        <h4
          id="deepcoro-cto-arteries-title"
          className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
        >
          {t('ProcessingDeepCoroCtoPerArtery', { defaultValue: 'Per-artery scores' })}
        </h4>
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[440px] table-fixed border-collapse text-left">
            <thead>
              <tr className="text-xs text-[#c5cbc5]">
                <th
                  className="px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroCtoArtery', { defaultValue: 'Artery' })}
                </th>
                <th
                  className="px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroCtoRawScore', { defaultValue: 'Raw score' })}
                </th>
                <th
                  className="px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroCtoRoundedScore', { defaultValue: 'Rounded score' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {DEEP_CORO_CTO_ARTERIES.map(artery => (
                <tr
                  key={artery}
                  data-testid={`deepcoro-cto-artery-${artery}`}
                >
                  <th
                    className="border-t border-white/10 px-3 py-3 text-xs font-semibold text-white"
                    scope="row"
                  >
                    {artery}
                    {artery === ctoArtery && (
                      <span className="ml-2 text-[#78b7f5]">
                        {t('ProcessingDeepCoroCtoSelected', { defaultValue: 'Selected' })}
                      </span>
                    )}
                  </th>
                  <td className="border-t border-white/10 px-3 py-3 text-xs tabular-nums text-white">
                    {perArtery[artery].jctoScore.toFixed(2)}
                  </td>
                  <td className="border-t border-white/10 px-3 py-3 text-xs tabular-nums text-[#c5cbc5]">
                    {perArtery[artery].jctoScoreInteger}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="deepcoro-cto-research-note"
      >
        {t('ProcessingDeepCoroCtoResearchNote', {
          defaultValue:
            'Research preview only. This imaging score covers four morphology components (0–4) and excludes the classic point for a previously failed attempt. Confirm every finding by operator review.',
        })}
      </p>
    </section>
  );
}

export default DeepCoroCtoResult;
