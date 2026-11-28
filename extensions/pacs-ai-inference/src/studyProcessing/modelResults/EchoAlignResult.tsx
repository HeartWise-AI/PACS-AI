import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  EchoModelResultMetadata,
  type EchoModelResultMetadataProps,
} from './EchoModelResultMetadata';
import {
  ECHO_ALIGN_OUTPUTS,
  getEchoAlignAorticScreening,
  type EchoAlignAorticScreening,
  type EchoAlignHead,
  type EchoAlignOutputDefinition,
  type EchoAlignOutputGroup,
  type EchoAlignResultPayload,
} from './echoAlignContract';

// Same layout as PanEchoResult (sections, labels, order, units, classes); the only
// addition is the research-use banner at the top.
export interface EchoAlignResultProps extends EchoModelResultMetadataProps {
  payload: EchoAlignResultPayload;
}

interface EchoAlignDisplayRow extends EchoAlignOutputDefinition {
  value: string;
  classification: string | null;
}

const GROUP_ORDER: readonly EchoAlignOutputGroup[] = [
  'leftVentricle',
  'rightHeart',
  'atria',
  'valves',
  'other',
];

const GROUP_LABELS: Record<EchoAlignOutputGroup, string> = {
  leftVentricle: 'Left ventricle',
  rightHeart: 'Right heart',
  atria: 'Atria',
  valves: 'Valves and hemodynamics',
  other: 'Other findings',
};

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)} %`;
}

function gradeLabel(grade: string): string {
  const text = grade.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
}

function displayHead(
  head: EchoAlignHead,
  output: EchoAlignOutputDefinition
): Pick<EchoAlignDisplayRow, 'value' | 'classification'> {
  if (head.type === 'regression') {
    return {
      value: `${head.value.toFixed(1)}${output.unit ? ` ${output.unit}` : ''}`,
      classification: null,
    };
  }
  if (head.type === 'classification') {
    // The finding itself (e.g. "Reduced" for RV systolic function), then the AI probability.
    return {
      value: head.called ? (output.called ?? 'Present') : (output.notCalled ?? 'Absent'),
      classification: `AI probability ${percent(head.probability)}`,
    };
  }
  const p = head.probabilities[head.grade];
  return {
    value: gradeLabel(head.grade),
    classification: p === undefined ? null : `AI probability ${percent(p)}`,
  };
}

export function getEchoAlignDisplayRows(payload: EchoAlignResultPayload): EchoAlignDisplayRow[] {
  return ECHO_ALIGN_OUTPUTS.flatMap(output => {
    const head = payload.heads[output.head];
    return head ? [{ ...output, ...displayHead(head, output) }] : [];
  });
}

export function EchoAlignResearchBanner() {
  const { t } = useTranslation('StudyList');
  return (
    <p
      className="mb-5 rounded-lg bg-[#b00020] px-4 py-3 text-sm font-bold text-white"
      role="note"
      data-testid="echoalign-research-banner"
    >
      {t('EchoAlignResearchBanner', {
        defaultValue: 'Research use only — EchoAlign (CC BY-NC 4.0), not for clinical decisions',
      })}
    </p>
  );
}

export function EchoAlignAorticScreeningBlock({
  screening,
}: {
  screening: EchoAlignAorticScreening;
}) {
  const { t } = useTranslation('StudyList');
  return (
    <section
      aria-labelledby="echoalign-as-screening-title"
      className="mb-5 rounded-lg border border-amber-400/40 bg-amber-500/[0.06] px-4 py-3"
      data-testid="echoalign-as-screening"
    >
      <h4
        id="echoalign-as-screening-title"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-200"
      >
        {t('PanEchoAsScreeningTitle', { defaultValue: 'Aortic stenosis: AI screening scores' })}
      </h4>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div data-testid="echoalign-as-severe">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('PanEchoAsSevere', { defaultValue: 'P(severe AS)' })}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-white">{percent(screening.severe)}</dd>
        </div>
        <div data-testid="echoalign-as-any">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('PanEchoAsAny', { defaultValue: 'P(any AS)' })}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-white">{percent(screening.any)}</dd>
        </div>
        <div data-testid="echoalign-av-vmax-estimate">
          <dt className="text-xs font-semibold text-[#c5cbc5]">
            {t('PanEchoAvVmaxEstimate', { defaultValue: 'AV peak velocity (AI estimate)' })}
          </dt>
          <dd className="text-lg font-bold tabular-nums text-white">
            {screening.vmaxEstimate === null ? '—' : `${screening.vmaxEstimate.toFixed(1)} m/s`}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs leading-5 text-amber-100">
        {t('EchoAlignAsScreeningNote', {
          defaultValue:
            'Screening scores, not a diagnosis. EchoAlign reads the 2D and colour clips, without the Doppler spectra: the AV peak velocity and gradients are AI estimates compressed towards the middle of the range, and on MHI the severe grade was never called. Use the measured Doppler values (Vmax, mean gradient, valve area).',
        })}
      </p>
    </section>
  );
}

export function EchoAlignResult({
  payload,
  modelName,
  modelVersion,
  status,
}: EchoAlignResultProps) {
  const { t } = useTranslation('StudyList');
  const rows = getEchoAlignDisplayRows(payload);
  const screening = getEchoAlignAorticScreening(payload);

  return (
    <section
      aria-labelledby="echoalign-result-title"
      data-testid="echoalign-result"
    >
      <EchoAlignResearchBanner />

      <EchoModelResultMetadata
        modelName={modelName}
        modelVersion={modelVersion}
        status={status}
      />

      <header className="mb-4">
        <h3
          id="echoalign-result-title"
          className="text-sm font-bold uppercase tracking-wide text-[#c5cbc5]"
        >
          {t('ProcessingEchoAlignTitle', { defaultValue: 'EchoAlign measurements and findings' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('ProcessingPanEchoDescription', {
            defaultValue: 'Study-level echocardiographic estimates grouped by cardiac structure.',
          })}
        </p>
      </header>

      {screening && <EchoAlignAorticScreeningBlock screening={screening} />}

      {rows.length === 0 ? (
        <p
          className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-[#c5cbc5]"
          role="status"
          data-testid="echoalign-partial-empty"
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
                aria-labelledby={`echoalign-group-${group}`}
                data-testid={`echoalign-group-${group}`}
              >
                <h4
                  id={`echoalign-group-${group}`}
                  className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
                >
                  {GROUP_LABELS[group]}
                </h4>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {groupRows.map(row => (
                    <div
                      key={row.head}
                      className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                      data-testid={`echoalign-output-${row.head}`}
                    >
                      <dt className="break-words text-xs font-semibold text-[#c5cbc5]">
                        {row.label}
                      </dt>
                      <dd className="mt-2">
                        <span className="block break-words text-lg font-bold tabular-nums text-white">
                          {row.value}
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
        data-testid="echoalign-assistive-note"
      >
        {t('ProcessingEchoAlignAssistiveNote', {
          defaultValue:
            'AI-generated research estimates (EchoAlign, MBZUAI BioMedIA / iCardio.ai / DKFZ, arXiv:2611.27517). Not validated for clinical use; review the complete study.',
        })}
      </p>
    </section>
  );
}

export default EchoAlignResult;
