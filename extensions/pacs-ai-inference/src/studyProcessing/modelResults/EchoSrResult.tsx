import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  displayUnit,
  echoSrGradingLabel,
  formatEchoSrValue,
  type EchoSrAsGrading,
  type EchoSrResultPayload,
  type EchoSrSummary,
  type EchoSrSummaryKey,
} from './echoSrContract';

export interface EchoSrResultProps {
  payload: EchoSrResultPayload;
  modelVersion?: string | null;
}

interface SummaryRow {
  key: EchoSrSummaryKey;
  labelKey: string;
  label: string;
  digits: number;
  withMethod?: boolean;
}

const SUMMARY_ROWS: readonly SummaryRow[] = [
  { key: 'avVmax', labelKey: 'EchoSrAvVmax', label: 'AV peak velocity (Vmax)', digits: 2 },
  { key: 'avMeanGradient', labelKey: 'EchoSrAvMeanGradient', label: 'AV mean gradient', digits: 0 },
  { key: 'avPeakGradient', labelKey: 'EchoSrAvPeakGradient', label: 'AV peak gradient', digits: 0 },
  { key: 'ava', labelKey: 'EchoSrAva', label: 'Aortic valve area', digits: 2, withMethod: true },
  { key: 'lvotDiameter', labelKey: 'EchoSrLvotDiameter', label: 'LVOT diameter', digits: 2 },
  { key: 'lvotVti', labelKey: 'EchoSrLvotVti', label: 'LVOT VTI', digits: 1 },
  { key: 'lvef', labelKey: 'EchoSrLvef', label: 'LVEF', digits: 0, withMethod: true },
  { key: 'trPeakGradient', labelKey: 'EchoSrTrPeakGradient', label: 'TR peak gradient', digits: 0 },
  { key: 'mvEA', labelKey: 'EchoSrMvEA', label: 'Mitral E/A', digits: 2 },
  { key: 'eOverEPrime', labelKey: 'EchoSrEOverEPrime', label: "E/e'", digits: 1 },
];

// The values shown above PanEcho/EchoPrime and in the compact block.
export const ECHO_SR_COMPACT_KEYS: readonly EchoSrSummaryKey[] = [
  'avVmax',
  'avMeanGradient',
  'ava',
  'lvef',
];

function gradeTone(grading: EchoSrAsGrading): string {
  switch (grading.grade) {
    case 'severe':
      return 'border-red-400/60 bg-red-500/15 text-red-200';
    case 'moderate':
      return 'border-amber-400/60 bg-amber-500/15 text-amber-100';
    case 'mild':
      return 'border-yellow-300/50 bg-yellow-400/10 text-yellow-100';
    default:
      return 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100';
  }
}

function useLanguage(): string | undefined {
  const translation = useTranslation('StudyList') as { i18n?: { language?: string } };
  return translation.i18n?.language;
}

export function EchoSrGradingBadge({ grading }: { grading: EchoSrAsGrading }) {
  const { t } = useTranslation('StudyList');
  const language = useLanguage();
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${gradeTone(grading)}`}
      data-testid="echo-sr-grading"
      data-grade={grading.grade}
    >
      <p className="text-base font-bold">{echoSrGradingLabel(grading, language)}</p>
      <p className="mt-1 text-xs opacity-90">
        {t('EchoSrGradingDerived', {
          defaultValue:
            'Derived from the measured Doppler values (guideline thresholds), not a physician read.',
        })}
        {grading.basis.length ? ` ${grading.basis.join(' · ')}` : ''}
      </p>
      {grading.avaNote && (
        <p
          className="mt-1 text-xs font-semibold"
          data-testid="echo-sr-ava-note"
        >
          {grading.avaNote.replace(/cm2/g, 'cm²')}
        </p>
      )}
    </div>
  );
}

function summaryValue(summary: EchoSrSummary, row: SummaryRow): string {
  const item = summary[row.key];
  const rendered = formatEchoSrValue(item, row.digits);
  return row.withMethod && item?.method ? `${rendered} (${item.method})` : rendered;
}

// Compact "measured values" block: shown first in the PanEcho/EchoPrime drawer.
export function EchoSrCompactSummary({ payload }: { payload: EchoSrResultPayload }) {
  const { t } = useTranslation('StudyList');
  const rows = SUMMARY_ROWS.filter(
    row => ECHO_SR_COMPACT_KEYS.includes(row.key) && payload.summary[row.key]
  );
  return (
    <section
      className="mb-4 rounded-lg border border-[#78b7f5]/40 bg-[#78b7f5]/[0.06] p-3"
      data-testid="echo-sr-compact"
      aria-labelledby="echo-sr-compact-title"
    >
      <h3
        id="echo-sr-compact-title"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
      >
        {t('EchoSrMeasuredValuesTitle', { defaultValue: 'Measured values (SR)' })}
      </h3>
      {payload.asGrading && <EchoSrGradingBadge grading={payload.asGrading} />}
      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {rows.map(row => (
            <div key={row.key}>
              <dt className="text-xs text-[#c5cbc5]">
                {t(row.labelKey, { defaultValue: row.label })}
              </dt>
              <dd className="font-bold tabular-nums text-white">
                {summaryValue(payload.summary, row)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 text-xs text-[#c5cbc5]">
        {t('EchoSrMeasuredFirstNote', {
          defaultValue:
            'Measured by the sonographer (echo SR). The AI estimates below do not replace these values.',
        })}
      </p>
    </section>
  );
}

export function EchoSrResult({ payload, modelVersion = null }: EchoSrResultProps) {
  const { t } = useTranslation('StudyList');
  const summaryRows = SUMMARY_ROWS.filter(row => payload.summary[row.key]);
  const vendors = Array.from(
    new Set(
      payload.source.documents
        .map(d => [d.manufacturer, d.model].filter(Boolean).join(' '))
        .filter(Boolean)
    )
  );
  const otherEf = payload.summary.lvef?.otherMethods ?? [];

  return (
    <section
      aria-labelledby="echo-sr-result-title"
      data-testid="echo-sr-result"
    >
      <header className="mb-4">
        <h3
          id="echo-sr-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('EchoSrTitle', { defaultValue: 'Echo measurements (SR)' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('EchoSrDescription', {
            defaultValue:
              "Measured values: read from the sonographer's structured report (DICOM SR), not estimated by an AI model.",
          })}
        </p>
      </header>

      {payload.asGrading ? (
        <EchoSrGradingBadge grading={payload.asGrading} />
      ) : (
        <p
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#c5cbc5]"
          data-testid="echo-sr-no-grading"
        >
          {t('EchoSrNoGrading', {
            defaultValue:
              'No aortic valve Doppler measurement in the SR: aortic stenosis not graded.',
          })}
        </p>
      )}

      {summaryRows.length > 0 ? (
        <table
          className="mt-4 w-full text-left text-sm"
          data-testid="echo-sr-summary"
        >
          <caption className="mb-2 text-left text-xs font-bold uppercase tracking-wide text-[#78b7f5]">
            {t('EchoSrSummaryTitle', { defaultValue: 'Key measured values' })}
          </caption>
          <tbody>
            {summaryRows.map(row => (
              <tr
                key={row.key}
                className="border-t border-white/10"
                data-testid={`echo-sr-summary-${row.key}`}
              >
                <th className="py-1.5 pr-3 font-semibold text-[#c5cbc5]">
                  {t(row.labelKey, { defaultValue: row.label })}
                </th>
                <td className="py-1.5 font-bold tabular-nums text-white">
                  {summaryValue(payload.summary, row)}
                </td>
                <td className="py-1.5 pl-2 text-xs text-[#9fa89f]">
                  {t('EchoSrMeasured', { defaultValue: 'Measured' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-[#c5cbc5]">
          {t('EchoSrNoSummary', { defaultValue: 'None of the key measurements is in the SR.' })}
        </p>
      )}
      {otherEf.length > 0 && (
        <p className="mt-1 text-xs text-[#9fa89f]">
          {t('EchoSrOtherEf', { defaultValue: 'LVEF by other methods:' })}{' '}
          {otherEf.map(item => `${item.method} ${item.value} %`).join(' · ')}
        </p>
      )}

      {payload.measurements.length > 0 && (
        <details
          className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
          data-testid="echo-sr-all-measurements"
        >
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-[#c5cbc5]">
            {t('EchoSrAllMeasurements', {
              count: payload.measurements.length,
              defaultValue: `All measurements (${payload.measurements.length})`,
            })}
          </summary>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr className="text-[#9fa89f]">
                <th className="py-1 pr-2">{t('EchoSrColumnSite', { defaultValue: 'Site' })}</th>
                <th className="py-1 pr-2">
                  {t('EchoSrColumnMeasurement', { defaultValue: 'Measurement' })}
                </th>
                <th className="py-1 pr-2">{t('EchoSrColumnValue', { defaultValue: 'Value' })}</th>
                <th className="py-1">
                  {t('EchoSrColumnMethod', { defaultValue: 'Method / mode' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {payload.measurements.map((measurement, index) => (
                <tr
                  key={index}
                  className="border-t border-white/5 text-white"
                >
                  <td className="py-1 pr-2">{measurement.site}</td>
                  <td className="py-1 pr-2">{measurement.measurement}</td>
                  <td className="py-1 pr-2 tabular-nums">
                    {`${measurement.value} ${displayUnit(measurement.unit)}`.trim()}
                  </td>
                  <td className="py-1 text-[#c5cbc5]">
                    {[measurement.method, measurement.mode, measurement.flowDirection]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <dl className="mt-4 space-y-1 text-xs text-[#9fa89f]">
        <div>
          <dt className="inline font-semibold">
            {t('EchoSrSource', { defaultValue: 'Source' })}:{' '}
          </dt>
          <dd className="inline">
            {t('EchoSrSourceValue', {
              count: payload.source.srCount,
              defaultValue: `${payload.source.srCount} DICOM SR`,
            })}
            {vendors.length ? ` · ${vendors.join(', ')}` : ''}
            {modelVersion ? ` · echo-sr-measurements ${modelVersion}` : ''}
          </dd>
        </div>
        {payload.rules.repeated && (
          <div>
            <dt className="inline font-semibold">
              {t('EchoSrRepeatedRule', { defaultValue: 'Repeated values' })}:{' '}
            </dt>
            <dd className="inline">{payload.rules.repeated}</dd>
          </div>
        )}
        {payload.asGrading?.guideline && (
          <div>
            <dt className="inline font-semibold">
              {t('EchoSrGuideline', { defaultValue: 'AS grading' })}:{' '}
            </dt>
            <dd className="inline">{payload.asGrading.guideline}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export default EchoSrResult;
