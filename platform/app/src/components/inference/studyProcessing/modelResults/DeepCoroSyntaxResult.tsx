import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEEP_CORO_SYNTAX_SEVERITY_CLASSES,
  type DeepCoroSyntaxResultPayload,
} from './deepCoroSyntaxContract';

export interface DeepCoroSyntaxResultProps {
  payload: DeepCoroSyntaxResultPayload;
}

export function DeepCoroSyntaxResult({ payload }: DeepCoroSyntaxResultProps) {
  const { t, i18n } = useTranslation('StudyList');
  const { syntax, territory, severityHead, intermediateToHigh } = payload.predictions;
  const percentage = new Intl.NumberFormat(i18n?.language, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const scores = [
    {
      key: 'global',
      label: t('ProcessingDeepCoroSyntaxModifiedScore', { defaultValue: 'Modified SYNTAX score' }),
      value: syntax.value,
      detail: syntax.band,
    },
    {
      key: 'left',
      label: t('ProcessingDeepCoroSyntaxLeftTerritory', { defaultValue: 'Left territory' }),
      value: territory.left,
    },
    {
      key: 'right',
      label: t('ProcessingDeepCoroSyntaxRightTerritory', { defaultValue: 'Right territory' }),
      value: territory.right,
    },
  ];

  return (
    <section
      aria-labelledby="deepcoro-syntax-title"
      data-testid="deepcoro-syntax-result"
    >
      <header className="mb-4">
        <h3
          id="deepcoro-syntax-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingDeepCoroSyntaxTitle', { defaultValue: 'DeepCORO-SYNTAX estimates' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingDeepCoroSyntaxDescription', {
            defaultValue:
              'Model-estimated modified SYNTAX scores and research severity probabilities from coronary angiography.',
          })}
        </p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        {scores.map(score => (
          <div
            key={score.key}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4"
            data-testid={`deepcoro-syntax-score-${score.key}`}
          >
            <dt className="text-xs font-semibold text-[#c5cbc5]">{score.label}</dt>
            <dd className="mt-3">
              <span className="text-2xl font-bold tabular-nums text-white">
                {score.value.toFixed(1)}
              </span>
              <span className="ml-1 text-xs text-[#c5cbc5]">
                {t('ProcessingDeepCoroSyntaxPoints', { defaultValue: 'points' })}
              </span>
              {score.detail && (
                <span className="mt-1 block text-xs font-semibold text-[#78b7f5]">
                  {score.detail}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <section
        className="mt-5"
        aria-labelledby="deepcoro-syntax-severity-title"
      >
        <h4
          id="deepcoro-syntax-severity-title"
          className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
        >
          {t('ProcessingDeepCoroSyntaxSeverity', { defaultValue: 'Severity probabilities' })}
        </h4>
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[520px] table-fixed border-collapse text-left">
            <thead>
              <tr className="text-xs text-[#c5cbc5]">
                <th
                  className="px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroSyntaxCategory', { defaultValue: 'Category' })}
                </th>
                <th
                  className="px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroSyntaxProbability', { defaultValue: 'Probability' })}
                </th>
                <th
                  className="px-3 py-3 font-semibold"
                  scope="col"
                >
                  {t('ProcessingDeepCoroSyntaxModelClass', { defaultValue: 'Model class' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {DEEP_CORO_SYNTAX_SEVERITY_CLASSES.map(severityClass => (
                <tr key={severityClass}>
                  <th
                    className="border-t border-white/10 px-3 py-3 text-xs text-white"
                    scope="row"
                  >
                    {severityClass}
                  </th>
                  <td className="border-t border-white/10 px-3 py-3 text-xs tabular-nums text-white">
                    {percentage.format(severityHead.probabilities[severityClass])}
                  </td>
                  <td className="border-t border-white/10 px-3 py-3 text-xs font-semibold text-[#c5cbc5]">
                    {severityHead.class === severityClass
                      ? t('ProcessingDeepCoroSyntaxSelected', { defaultValue: 'Selected' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dl className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs">
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="font-semibold text-[#c5cbc5]">
            {t('ProcessingDeepCoroSyntaxThreshold', {
              defaultValue: 'Intermediate-to-high research threshold',
            })}
          </dt>
          <dd className="font-semibold text-white">
            {intermediateToHigh.threshold.toFixed(1)}{' '}
            {t('ProcessingDeepCoroSyntaxPoints', { defaultValue: 'points' })} ·{' '}
            {intermediateToHigh.positive
              ? t('ProcessingDeepCoroSyntaxAtOrAbove', { defaultValue: 'At or above threshold' })
              : t('ProcessingDeepCoroSyntaxBelow', { defaultValue: 'Below threshold' })}
          </dd>
        </div>
      </dl>

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="deepcoro-syntax-research-note"
      >
        {t('ProcessingDeepCoroSyntaxResearchNote', {
          defaultValue:
            'Research use only. This modified SYNTAX estimate is a triage aid, may underestimate occlusive or multivessel disease, and must be confirmed by image review before use.',
        })}
      </p>
    </section>
  );
}

export default DeepCoroSyntaxResult;
