import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  EchoModelResultMetadata,
  type EchoModelResultMetadataProps,
} from './EchoModelResultMetadata';
import {
  ECHO_PRIME_BINARY_OUTPUTS,
  ECHO_PRIME_CONTINUOUS_OUTPUTS,
  type EchoPrimeResultPayload,
} from './echoPrimeContract';

export interface EchoPrimeResultProps extends EchoModelResultMetadataProps {
  payload: EchoPrimeResultPayload;
}

interface ReportSection {
  title: string | null;
  content: string;
}

export function parseEchoPrimeReport(report: string | null): ReportSection[] {
  if (!report) {
    return [];
  }

  return report
    .split('[SEP]')
    .map(section => section.trim())
    .filter(Boolean)
    .map(section => {
      const separator = section.indexOf(':');
      return separator > 0
        ? {
            title: section.slice(0, separator).trim(),
            content: section.slice(separator + 1).trim(),
          }
        : { title: null, content: section };
    });
}

function humanizeKey(key: string): string {
  const normalized = key.replace(/_/g, ' ').trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : key;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatUnknownValue(value: unknown): string {
  const numberValue = finiteNumber(value);
  if (numberValue !== null) {
    return numberValue >= 0 && numberValue <= 1
      ? `${(numberValue * 100).toFixed(1)}%`
      : numberValue.toFixed(1);
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

export function EchoPrimeResult({
  payload,
  modelName,
  modelVersion,
  status,
}: EchoPrimeResultProps) {
  const { t } = useTranslation('StudyList');
  const reportSections = parseEchoPrimeReport(payload.diagnosis);
  const documentedKeys = new Set<string>([
    ...ECHO_PRIME_CONTINUOUS_OUTPUTS.map(output => output.key),
    ...ECHO_PRIME_BINARY_OUTPUTS.map(output => output.key),
  ]);
  const continuous = ECHO_PRIME_CONTINUOUS_OUTPUTS.filter(output =>
    Object.prototype.hasOwnProperty.call(payload.predictions, output.key)
  );
  const binary = ECHO_PRIME_BINARY_OUTPUTS.filter(output =>
    Object.prototype.hasOwnProperty.call(payload.predictions, output.key)
  );
  const additional = Object.keys(payload.predictions)
    .filter(key => !documentedKeys.has(key))
    .sort((left, right) => left.localeCompare(right));

  return (
    <section
      aria-labelledby="echoprime-result-title"
      data-testid="echoprime-result"
    >
      <EchoModelResultMetadata
        modelName={modelName}
        modelVersion={modelVersion}
        status={status}
      />

      <header className="mb-4">
        <h3
          id="echoprime-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingEchoPrimeTitle', { defaultValue: 'EchoPrime interpretation' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingEchoPrimeDescription', {
            defaultValue: 'Generated report sections, measurements, and classified findings.',
          })}
        </p>
      </header>

      {reportSections.length > 0 && (
        <section
          className="mb-5"
          aria-labelledby="echoprime-report-heading"
          data-testid="echoprime-report"
        >
          <h4
            id="echoprime-report-heading"
            className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
          >
            {t('ProcessingEchoPrimeReport', { defaultValue: 'Generated report' })}
          </h4>
          <div className="space-y-2">
            {reportSections.map((section, index) => (
              <div
                key={`${section.title ?? 'section'}-${index}`}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                {section.title && (
                  <h5 className="break-words text-xs font-bold text-white">{section.title}</h5>
                )}
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-[#c5cbc5]">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {continuous.length > 0 && (
        <section
          className="mb-5"
          aria-labelledby="echoprime-measurements-heading"
          data-testid="echoprime-measurements"
        >
          <h4
            id="echoprime-measurements-heading"
            className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
          >
            {t('ProcessingEchoPrimeMeasurements', { defaultValue: 'Continuous measurements' })}
          </h4>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {continuous.map(output => {
              const value = finiteNumber(payload.predictions[output.key]);
              return (
                <div
                  key={output.key}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                  data-testid={`echoprime-output-${output.key}`}
                >
                  <dt className="text-xs font-semibold text-[#c5cbc5]">{output.label}</dt>
                  <dd className="mt-2 text-lg font-bold tabular-nums text-white">
                    {value === null ? '—' : `${value.toFixed(1)} ${output.unit}`}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      {binary.length > 0 && (
        <section
          className="mb-5"
          aria-labelledby="echoprime-findings-heading"
          data-testid="echoprime-findings"
        >
          <h4
            id="echoprime-findings-heading"
            className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
          >
            {t('ProcessingEchoPrimeFindings', { defaultValue: 'Binary findings' })}
          </h4>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {binary.map(output => {
              const probability = finiteNumber(payload.predictions[output.key]);
              const detected = probability === null ? null : probability >= output.threshold;
              return (
                <div
                  key={output.key}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                  data-testid={`echoprime-output-${output.key}`}
                >
                  <dt className="break-words text-xs font-semibold text-[#c5cbc5]">
                    {output.label}
                  </dt>
                  <dd className="mt-2">
                    <span
                      className={`block text-sm font-bold ${
                        detected === true
                          ? 'text-[#f8d84a]'
                          : detected === false
                            ? 'text-[#79d19a]'
                            : 'text-[#9fa89f]'
                      }`}
                    >
                      {detected === null
                        ? t('ProcessingEchoValueUnavailable', { defaultValue: 'Unavailable' })
                        : detected
                          ? t('ProcessingEchoFindingDetected', { defaultValue: 'Detected' })
                          : t('ProcessingEchoFindingNotDetected', {
                              defaultValue: 'Not detected',
                            })}
                    </span>
                    {probability !== null && (
                      <span className="mt-1 block text-xs tabular-nums text-[#c5cbc5]">
                        {t('ProcessingEchoProbability', { defaultValue: 'Probability' })}:{' '}
                        {(probability * 100).toFixed(1)}%
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      {additional.length > 0 && (
        <section
          className="mb-5"
          aria-labelledby="echoprime-additional-heading"
          data-testid="echoprime-additional"
        >
          <h4
            id="echoprime-additional-heading"
            className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
          >
            {t('ProcessingEchoAdditionalOutputs', { defaultValue: 'Additional outputs' })}
          </h4>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {additional.map(key => (
              <div
                key={key}
                className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <dt className="break-words text-xs font-semibold text-[#c5cbc5]">
                  {humanizeKey(key)}
                </dt>
                <dd className="mt-2 break-words text-sm font-bold tabular-nums text-white">
                  {formatUnknownValue(payload.predictions[key])}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {reportSections.length === 0 &&
        continuous.length === 0 &&
        binary.length === 0 &&
        additional.length === 0 && (
          <p
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-[#c5cbc5]"
            role="status"
            data-testid="echoprime-partial-empty"
          >
            {t('ProcessingEchoNoPresentableFindings', {
              defaultValue: 'No presentable measurements or findings were returned.',
            })}
          </p>
        )}

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="echoprime-assistive-note"
      >
        {t('ProcessingEchoPrimeAssistiveNote', {
          defaultValue:
            'AI-generated echocardiographic interpretation. Review the complete study and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default EchoPrimeResult;
