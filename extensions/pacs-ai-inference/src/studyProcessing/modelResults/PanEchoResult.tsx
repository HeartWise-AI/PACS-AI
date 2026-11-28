import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EchoModelResultMetadata,
  type EchoModelResultMetadataProps,
} from './EchoModelResultMetadata';
import { PAN_ECHO_MODEL_NAME, type PanEchoResultPayload } from './panEchoContract';
import type { EchoSrResultPayload } from './echoSrContract';
import { buildReport, type EchoStructuredReport } from './echoReport/echoReport';
import { EchoStructuredReportView } from './echoReport/EchoStructuredReportView';

export interface PanEchoResultProps extends EchoModelResultMetadataProps {
  payload: PanEchoResultPayload;
  // The study's measured echo SR values (echo-sr-measurements), shown first in each section.
  measured?: EchoSrResultPayload | null;
  // DICOM PatientSex ('M' / 'F'), for sex-specific cut-offs; male cut-offs when unknown.
  patientSex?: string | null;
}

// The stored result as returned; tests and older callers may pass only the parsed fields.
function rawResult(payload: PanEchoResultPayload): Record<string, unknown> {
  return payload.raw ?? { diagnosis: payload.diagnosis, predictions: payload.predictions };
}

export function buildPanEchoReport(
  payload: PanEchoResultPayload,
  measured: EchoSrResultPayload | null = null,
  patientSex: string | null = null
): EchoStructuredReport {
  return buildReport(PAN_ECHO_MODEL_NAME, rawResult(payload), measured, patientSex);
}

export function PanEchoResult({
  payload,
  modelName,
  modelVersion,
  status,
  measured = null,
  patientSex = null,
}: PanEchoResultProps) {
  const { t } = useTranslation('StudyList');
  const report = useMemo(
    () => buildPanEchoReport(payload, measured, patientSex),
    [payload, measured, patientSex]
  );

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
          {t('ProcessingPanEchoReportTitle', { defaultValue: 'PanEcho structured echo report' })}
        </h3>
        <p className="mt-2 text-sm text-[#c5cbc5]">
          {t('EchoReportDescription', {
            defaultValue:
              'By structure, in standard echo order: measured SR values first, then the AI estimates. The conclusion lists only positive findings.',
          })}
        </p>
      </header>

      {report.sections.length === 0 ? (
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
        <EchoStructuredReportView report={report} />
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
