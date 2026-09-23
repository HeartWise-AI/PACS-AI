import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS,
  DEEP_CORO_MACE_PRIMARY_ENDPOINTS,
  type DeepCoroMaceEndpointKey,
  type DeepCoroMaceResultPayload,
} from './deepCoroMaceContract';

export interface DeepCoroMaceResultProps {
  payload: DeepCoroMaceResultPayload;
}

const endpointLabels: Record<DeepCoroMaceEndpointKey, [string, string]> = {
  compositeMace: ['ProcessingDeepCoroMaceEndpointComposite', 'Composite MACE'],
  urgentRevascularization: [
    'ProcessingDeepCoroMaceEndpointUrgentRevascularization',
    'Urgent revascularization',
  ],
  nonFatalMyocardialInfarction: [
    'ProcessingDeepCoroMaceEndpointNonFatalMi',
    'Non-fatal myocardial infarction',
  ],
  completeCoronaryOcclusion: [
    'ProcessingDeepCoroMaceEndpointCompleteOcclusion',
    'Complete coronary occlusion',
  ],
  cardiovascularDeath: [
    'ProcessingDeepCoroMaceEndpointCardiovascularDeath',
    'Cardiovascular death',
  ],
  nonFatalStroke: ['ProcessingDeepCoroMaceEndpointNonFatalStroke', 'Non-fatal stroke'],
  heartFailureHospitalization: [
    'ProcessingDeepCoroMaceEndpointHeartFailureHospitalization',
    'Heart-failure hospitalization',
  ],
  lifeThreateningArrhythmia: [
    'ProcessingDeepCoroMaceEndpointLifeThreateningArrhythmia',
    'Life-threatening arrhythmia',
  ],
  cardiogenicShock: ['ProcessingDeepCoroMaceEndpointCardiogenicShock', 'Cardiogenic shock'],
};

interface EndpointTableProps {
  id: string;
  titleKey: string;
  title: string;
  keys: readonly DeepCoroMaceEndpointKey[];
  values: Record<
    string,
    { probability: number; threshold: number; aboveResearchThreshold: boolean }
  >;
  locale?: string;
}

function EndpointTable({ id, titleKey, title, keys, values, locale }: EndpointTableProps) {
  const { t } = useTranslation('StudyList');
  const percentage = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <section
      aria-labelledby={`deepcoro-mace-${id}-title`}
      data-testid={`deepcoro-mace-${id}`}
    >
      <h4
        id={`deepcoro-mace-${id}-title`}
        className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
      >
        {t(titleKey, { defaultValue: title })}
      </h4>
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]">
        <table className="min-w-[660px] table-fixed border-collapse text-left">
          <caption className="sr-only">{t(titleKey, { defaultValue: title })}</caption>
          <thead>
            <tr className="text-xs text-[#c5cbc5]">
              <th
                scope="col"
                className="w-[40%] px-3 py-3 font-semibold"
              >
                {t('ProcessingDeepCoroMaceEndpoint', { defaultValue: 'Endpoint' })}
              </th>
              <th
                scope="col"
                className="w-[20%] px-3 py-3 font-semibold"
              >
                {t('ProcessingDeepCoroMaceScore', { defaultValue: 'Research score' })}
              </th>
              <th
                scope="col"
                className="w-[20%] px-3 py-3 font-semibold"
              >
                {t('ProcessingDeepCoroMaceThreshold', { defaultValue: 'Threshold' })}
              </th>
              <th
                scope="col"
                className="w-[20%] px-3 py-3 font-semibold"
              >
                {t('ProcessingDeepCoroMaceThresholdState', { defaultValue: 'Threshold state' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {keys.map(key => {
              const endpoint = values[key];
              const [labelKey, label] = endpointLabels[key];
              return (
                <tr
                  key={key}
                  data-testid={`deepcoro-mace-endpoint-${key}`}
                >
                  <th
                    scope="row"
                    className="border-t border-white/10 px-3 py-3 align-top text-xs font-semibold text-white"
                  >
                    {t(labelKey, { defaultValue: label })}
                    {key === 'cardiovascularDeath' && (
                      <span className="mt-1 block font-normal leading-5 text-[#c5cbc5]">
                        {t('ProcessingDeepCoroMaceCardiovascularDeathCaution', {
                          defaultValue:
                            'Exploratory only: the held-out cohort included very few cardiovascular deaths, so this component is not reliable as a standalone estimate.',
                        })}
                      </span>
                    )}
                  </th>
                  <td className="border-t border-white/10 px-3 py-3 align-top text-xs tabular-nums text-white">
                    {percentage.format(endpoint.probability)}
                  </td>
                  <td className="border-t border-white/10 px-3 py-3 align-top text-xs tabular-nums text-[#c5cbc5]">
                    {percentage.format(endpoint.threshold)}
                  </td>
                  <td className="border-t border-white/10 px-3 py-3 align-top text-xs font-semibold text-white">
                    {endpoint.aboveResearchThreshold
                      ? t('ProcessingDeepCoroMaceAtOrAboveThreshold', {
                          defaultValue: 'At or above threshold',
                        })
                      : t('ProcessingDeepCoroMaceBelowThreshold', {
                          defaultValue: 'Below threshold',
                        })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DeepCoroMaceResult({ payload }: DeepCoroMaceResultProps) {
  const { t, i18n } = useTranslation('StudyList');

  return (
    <section
      aria-labelledby="deepcoro-mace-title"
      data-testid="deepcoro-mace-result"
    >
      <header className="mb-4">
        <h3
          id="deepcoro-mace-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingDeepCoroMaceTitle', {
            defaultValue: 'DeepCORO-MACE one-year research scores',
          })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingDeepCoroMaceDescription', {
            defaultValue:
              'Model-generated one-year endpoint scores from coronary angiography, grouped by intended research use.',
          })}
        </p>
      </header>

      <div className="space-y-5">
        <EndpointTable
          id="primary"
          titleKey="ProcessingDeepCoroMacePrimary"
          title="Primary endpoints"
          keys={DEEP_CORO_MACE_PRIMARY_ENDPOINTS}
          values={payload.predictions.primary}
          locale={i18n?.language}
        />
        <EndpointTable
          id="exploratory"
          titleKey="ProcessingDeepCoroMaceExploratory"
          title="Exploratory endpoints"
          keys={DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS}
          values={payload.predictions.exploratory}
          locale={i18n?.language}
        />
      </div>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="deepcoro-mace-research-note"
      >
        {t('ProcessingDeepCoroMaceResearchNote', {
          defaultValue:
            'Research use only. Scores and threshold flags are uncalibrated, are not validated clinical risk estimates or diagnoses, and must not guide care.',
        })}
      </p>
    </section>
  );
}

export default DeepCoroMaceResult;
