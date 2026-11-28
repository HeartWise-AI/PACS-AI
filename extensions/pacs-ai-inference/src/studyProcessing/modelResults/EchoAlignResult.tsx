import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EchoModelResultMetadata,
  type EchoModelResultMetadataProps,
} from './EchoModelResultMetadata';
import { ECHO_ALIGN_MODEL_NAME, type EchoAlignResultPayload } from './echoAlignContract';
import type { EchoSrResultPayload } from './echoSrContract';
import { buildReport, type EchoStructuredReport } from './echoReport/echoReport';
import { EchoStructuredReportView } from './echoReport/EchoStructuredReportView';

// Same structured report as PanEchoResult; the research-use banner stays at the very top.
export interface EchoAlignResultProps extends EchoModelResultMetadataProps {
  payload: EchoAlignResultPayload;
  measured?: EchoSrResultPayload | null;
  patientSex?: string | null;
}

function rawResult(payload: EchoAlignResultPayload): Record<string, unknown> {
  return payload.raw ?? { diagnosis: payload.diagnosis, predictions: { allHeads: payload.heads } };
}

export function buildEchoAlignReport(
  payload: EchoAlignResultPayload,
  measured: EchoSrResultPayload | null = null,
  patientSex: string | null = null
): EchoStructuredReport {
  return buildReport(ECHO_ALIGN_MODEL_NAME, rawResult(payload), measured, patientSex);
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

export function EchoAlignResult({
  payload,
  modelName,
  modelVersion,
  status,
  measured = null,
  patientSex = null,
}: EchoAlignResultProps) {
  const { t } = useTranslation('StudyList');
  const report = useMemo(
    () => buildEchoAlignReport(payload, measured, patientSex),
    [payload, measured, patientSex]
  );

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
          {t('ProcessingEchoAlignReportTitle', { defaultValue: 'EchoAlign structured echo report' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('EchoReportDescription', {
            defaultValue:
              'By structure, in standard echo order: measured SR values first, then the AI estimates. The conclusion lists only positive findings.',
          })}
        </p>
      </header>

      {payload.skipReason && (
        <p
          className="mb-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-[#c5cbc5]"
          role="status"
          data-testid="echoalign-skip-reason"
        >
          {payload.skipReason === 'TEE_NOT_SUPPORTED'
            ? t('EchoAlignSkipTee', {
                defaultValue: 'Not run: transesophageal echo (TEE) is not supported by EchoAlign.',
              })
            : payload.skipReason === 'STUDY_TOO_LARGE'
              ? t('EchoAlignSkipTooLarge', {
                  defaultValue:
                    'Not run: the study exceeds the size limits of this research model.',
                })
              : t('EchoAlignSkipNoClips', {
                  defaultValue: 'Not run: no usable transthoracic echo clips in the study.',
                })}
        </p>
      )}

      {payload.skipReason ? null : report.sections.length === 0 ? (
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
        <EchoStructuredReportView report={report} />
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
