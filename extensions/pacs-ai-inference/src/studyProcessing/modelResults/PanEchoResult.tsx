import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  EchoModelResultMetadata,
  type EchoModelResultMetadataProps,
} from './EchoModelResultMetadata';
import {
  PAN_ECHO_AS_KEY,
  PAN_ECHO_AV_VMAX_KEY,
  PAN_ECHO_AV_VMAX_UNCORRECTED_KEY,
  PAN_ECHO_OUTPUTS,
  getPanEchoAorticScreening,
  type PanEchoAorticScreening,
  type PanEchoOutputDefinition,
  type PanEchoOutputGroup,
  type PanEchoResultPayload,
} from './panEchoContract';

export interface PanEchoResultProps extends EchoModelResultMetadataProps {
  payload: PanEchoResultPayload;
}

interface PanEchoDisplayRow extends PanEchoOutputDefinition {
  classification: string | null;
  value: unknown;
}

const GROUP_ORDER: readonly PanEchoOutputGroup[] = [
  'leftVentricle',
  'rightHeart',
  'atria',
  'valves',
  'other',
];

const GROUP_LABELS: Record<PanEchoOutputGroup, string> = {
  leftVentricle: 'Left ventricle',
  rightHeart: 'Right heart',
  atria: 'Atria',
  valves: 'Valves and hemodynamics',
  other: 'Other findings',
};

function classificationFromDiagnosis(diagnosis: string | undefined): string | null {
  if (!diagnosis) {
    return null;
  }

  const interpretedMeasurement = diagnosis.match(/\(([^()]+)\)\s*$/);
  return interpretedMeasurement?.[1] ?? diagnosis;
}

function formatValue(value: unknown, unit?: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const finiteValues = value.filter(
      (candidate): candidate is number =>
        typeof candidate === 'number' && Number.isFinite(candidate)
    );
    if (finiteValues.length === value.length && finiteValues.length > 0) {
      return finiteValues.map(candidate => candidate.toFixed(3)).join(', ');
    }
  }
  return '—';
}

// Shown in the aortic stenosis screening block, never as a diagnosis row.
const SCREENING_KEYS = new Set([PAN_ECHO_AS_KEY, PAN_ECHO_AV_VMAX_KEY, PAN_ECHO_AV_VMAX_UNCORRECTED_KEY]);

export function getPanEchoDisplayRows(payload: PanEchoResultPayload): PanEchoDisplayRow[] {
  const documentedKeys = new Set(PAN_ECHO_OUTPUTS.map(output => output.key));
  const documentedRows = PAN_ECHO_OUTPUTS.filter(output => !SCREENING_KEYS.has(output.key)).flatMap(
    output => {
      const hasPrediction = Object.prototype.hasOwnProperty.call(payload.predictions, output.key);
      const hasDiagnosis = Object.prototype.hasOwnProperty.call(payload.diagnoses, output.key);
      return hasPrediction || hasDiagnosis
        ? [
            {
              ...output,
              value: payload.predictions[output.key],
              classification: classificationFromDiagnosis(payload.diagnoses[output.key]),
            },
          ]
        : [];
    }
  );

  const additionalKeys = Array.from(
    new Set([...Object.keys(payload.predictions), ...Object.keys(payload.diagnoses)])
  )
    .filter(key => !documentedKeys.has(key) && !SCREENING_KEYS.has(key))
    .sort((left, right) => left.localeCompare(right));

  return [
    ...documentedRows,
    ...additionalKeys.map(key => ({
      key,
      label: key,
      group: 'other' as const,
      value: payload.predictions[key],
      classification: classificationFromDiagnosis(payload.diagnoses[key]),
    })),
  ];
}

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)} %`;
}

export function PanEchoAorticScreeningBlock({ screening }: { screening: PanEchoAorticScreening }) {
  const { t } = useTranslation('StudyList');
  return (
    <section
      aria-labelledby="panecho-as-screening-title"
      className="mb-5 rounded-lg border border-amber-400/40 bg-amber-500/[0.06] px-4 py-3"
      data-testid="panecho-as-screening"
    >
      <h4
        id="panecho-as-screening-title"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-200"
      >
        {t('PanEchoAsScreeningTitle', { defaultValue: 'Aortic stenosis: AI screening scores' })}
      </h4>
      {screening.calibratedLabel && (
        <div className="mb-2" data-testid="panecho-as-calibrated">
          <span className="text-xs font-semibold text-[#c5cbc5]">
            {t('PanEchoAsCalibratedLabel', { defaultValue: 'MHI-calibrated screening label' })}
            {': '}
          </span>
          <span className="text-base font-bold text-white">
            {screening.calibratedLabel === 'Significant AS likely, severe possible'
              ? t('PanEchoAsCalibratedSevere', { defaultValue: 'Significant AS likely, severe possible' })
              : screening.calibratedLabel === 'Significant AS likely'
                ? t('PanEchoAsCalibratedSignificant', { defaultValue: 'Significant AS likely' })
                : t('PanEchoAsCalibratedNone', { defaultValue: 'No significant AS suspected' })}
          </span>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div data-testid="panecho-as-severe">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('PanEchoAsSevere', { defaultValue: 'P(severe AS)' })}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-white">{percent(screening.severe)}</dd>
        </div>
        <div data-testid="panecho-as-any">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('PanEchoAsAny', { defaultValue: 'P(any AS)' })}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-white">{percent(screening.any)}</dd>
        </div>
        <div data-testid="panecho-av-vmax-estimate">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {screening.vmaxUncorrected === null
              ? t('PanEchoAvVmaxEstimate', { defaultValue: 'AV peak velocity (AI estimate)' })
              : t('PanEchoAvVmaxCalibrated', {
                  defaultValue: 'AV peak velocity (AI estimate, MHI-calibrated)',
                })}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-white">
            {screening.vmaxEstimate === null ? '—' : `${screening.vmaxEstimate.toFixed(1)} m/s`}
          </dd>
          {screening.vmaxUncorrected !== null && (
            <dd className="text-xs text-[#c5cbc5]" data-testid="panecho-av-vmax-uncorrected">
              {t('PanEchoAvVmaxUncorrected', {
                defaultValue: 'uncorrected model output {{value}} m/s',
                value: screening.vmaxUncorrected.toFixed(1),
              })}
            </dd>
          )}
        </div>
      </dl>
      <p className="mt-2 text-xs leading-5 text-amber-100">
        {screening.calibratedLabel ? t('PanEchoAsCalibratedNote', {
          defaultValue:
            'Screening label, not a diagnosis. \'Significant AS likely\' means moderate or severe aortic stenosis is likely; the threshold and the AV peak velocity correction were fitted on MHI echos only (MHI locked test: sensitivity 0.81, specificity 0.91 against echos without AS). PanEcho reads the 2D clips only, without the Doppler spectra, and a negative label does not rule out aortic stenosis. Use the measured Doppler values (Vmax, mean gradient, valve area).',
        }) : t('PanEchoAsScreeningNote', {
          defaultValue:
            'Screening scores, not a diagnosis. PanEcho reads the 2D clips only, without the Doppler spectra: the AV peak velocity is an AI estimate that under-estimates severe AS, and a low score does not rule out aortic stenosis. Use the measured Doppler values (Vmax, mean gradient, valve area).',
        })}
      </p>
    </section>
  );
}

export function PanEchoResult({ payload, modelName, modelVersion, status }: PanEchoResultProps) {
  const { t } = useTranslation('StudyList');
  const rows = getPanEchoDisplayRows(payload);
  const screening = getPanEchoAorticScreening(payload.predictions, payload.diagnoses);

  return (
    <section
      aria-labelledby="panecho-result-title"
      data-testid="panecho-result"
    >
      <EchoModelResultMetadata
        modelName={modelName}
        modelVersion={modelVersion}
        status={status}
      />

      <header className="mb-4">
        <h3
          id="panecho-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingPanEchoTitle', { defaultValue: 'PanEcho measurements and findings' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingPanEchoDescription', {
            defaultValue: 'Study-level echocardiographic estimates grouped by cardiac structure.',
          })}
        </p>
      </header>

      {screening && <PanEchoAorticScreeningBlock screening={screening} />}

      {rows.length === 0 ? (
        <p
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-[#c5cbc5]"
          role="status"
          data-testid="panecho-partial-empty"
        >
          {t('ProcessingEchoNoPresentableFindings', {
            defaultValue: 'No presentable measurements or findings were returned.',
          })}
        </p>
      ) : (
        <div className="space-y-5">
          {GROUP_ORDER.map(group => {
            const groupRows = rows.filter(row => row.group === group);
            if (!groupRows.length) {
              return null;
            }

            return (
              <section
                key={group}
                aria-labelledby={`panecho-group-${group}`}
                data-testid={`panecho-group-${group}`}
              >
                <h4
                  id={`panecho-group-${group}`}
                  className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
                >
                  {GROUP_LABELS[group]}
                </h4>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {groupRows.map(row => (
                    <div
                      key={row.key}
                      className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                      data-testid={`panecho-output-${row.key}`}
                    >
                      <dt className="break-words text-xs font-semibold text-[#c5cbc5]">
                        {row.label}
                      </dt>
                      <dd className="mt-2">
                        <span className="block break-words text-lg font-bold tabular-nums text-white">
                          {formatValue(row.value, row.unit)}
                        </span>
                        {row.classification && (
                          <span className="mt-1 block break-words text-xs font-semibold text-[#79d19a]">
                            {row.classification}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
      )}

      <p
        className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-[#c5cbc5]"
        role="note"
        data-testid="panecho-assistive-note"
      >
        {t('ProcessingPanEchoAssistiveNote', {
          defaultValue:
            'AI-generated echocardiographic estimates. Review the complete study and clinical context before use.',
        })}
      </p>
    </section>
  );
}

export default PanEchoResult;
