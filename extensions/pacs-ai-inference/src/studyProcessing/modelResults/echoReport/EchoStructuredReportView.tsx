import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ECHO_REPORT_CONFIG,
  MODEL_ECHOALIGN,
  formatNumber,
  formatPercent,
  languageOf,
  type AiRow,
  type AsScreening,
  type EchoStructuredReport,
  type Lang,
  type ReportSection,
} from './echoReport';

// Structured echo report: sections in echo order (measured SR values first, then AI estimates),
// the aortic valve as one subsection, and the conclusion of positive findings at the end.
export interface EchoStructuredReportViewProps {
  report: EchoStructuredReport;
}

function useLang(): Lang {
  const translation = useTranslation('StudyList') as { i18n?: { language?: string } };
  return languageOf(translation.i18n?.language);
}

function gradeTone(grade: string | null): string {
  switch (grade) {
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

function SourceTag({ source }: { source: 'measured' | 'ai' }) {
  const lang = useLang();
  const strings = ECHO_REPORT_CONFIG.strings;
  const text = source === 'measured' ? strings.measured[lang] : strings.aiEstimate[lang];
  return (
    <span
      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        source === 'measured' ? 'bg-[#78b7f5]/20 text-[#9fd0ff]' : 'bg-white/10 text-[#c5cbc5]'
      }`}
      data-testid={`echo-report-tag-${source}`}
    >
      {text}
    </span>
  );
}

// 0.40 -> "0.4", 23.10 -> "23.1", 10.00 -> "10".
function trimmed(value: number, lang: Lang): string {
  return formatNumber(value, 2, lang).replace(/([.,]\d*[1-9])0+$/, '$1').replace(/[.,]0+$/, '');
}

function aiRowDetail(row: AiRow, lang: Lang): string | null {
  const parts: string[] = [];
  if (row.band !== null && row.band !== undefined) {
    parts.push(`± ${trimmed(row.band, lang)}${row.unit ? ` ${row.unit}` : ''}`);
  }
  if (row.probability !== null && row.probability !== undefined) {
    let text = formatPercent(row.probability) as string;
    if (row.threshold !== null && row.threshold !== undefined) {
      text += ` (${ECHO_REPORT_CONFIG.strings.threshold[lang]} ${formatPercent(row.threshold)})`;
    }
    parts.push(text);
  }
  return parts.length ? parts.join(' · ') : null;
}

function MeasuredGrade({ grade }: { grade: NonNullable<ReportSection['measuredGrade']> }) {
  const { t } = useTranslation('StudyList');
  const lang = useLang();
  const basis = Array.isArray(grade.basis) ? (grade.basis as string[]) : [];
  return (
    <div
      className={`mb-2 rounded-lg border px-3 py-2 ${gradeTone(grade.grade)}`}
      data-testid="echo-report-as-grade"
      data-grade={grade.grade ?? ''}
    >
      <p className="text-sm font-bold">
        {(lang === 'fr' ? grade.fr : grade.en) ?? grade.en}
        <SourceTag source="measured" />
      </p>
      <p className="mt-1 text-xs opacity-90">
        {t('EchoSrGradingDerived', {
          defaultValue:
            'Derived from the measured Doppler values (guideline thresholds), not a physician read.',
        })}
        {basis.length ? ` ${basis.join(' · ')}` : ''}
      </p>
      {typeof grade.avaNote === 'string' && grade.avaNote && (
        <p className="mt-1 text-xs font-semibold">{grade.avaNote.replace(/cm2/g, 'cm²')}</p>
      )}
    </div>
  );
}

function AsScreeningBlock({ screening, model }: { screening: AsScreening; model: string | null }) {
  const { t } = useTranslation('StudyList');
  const lang = useLang();
  const pct = (value: number | null | undefined) =>
    value === null || value === undefined ? '—' : `${Math.round(value * 100)} %`;
  const vmax =
    screening.vmax === null
      ? '—'
      : `${formatNumber(screening.vmax, 1, lang)} m/s${
          screening.vmaxBand !== null ? ` ± ${trimmed(screening.vmaxBand, lang)}` : ''
        }`;
  const isEchoAlign = model === MODEL_ECHOALIGN;
  const calibrated = screening.calibratedLabel;
  return (
    <div
      className="my-2 rounded-lg border border-amber-400/40 bg-amber-500/[0.06] px-3 py-2"
      data-testid="echo-report-as-screening"
    >
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-200">
        {t('EchoReportAsScreeningTitle', { defaultValue: 'Aortic stenosis screening' })}
        <SourceTag source="ai" />
      </p>
      {calibrated && (
        <p className="mb-1" data-testid="echo-report-as-calibrated">
          <span className="text-xs font-semibold text-[#c5cbc5]">
            {t('PanEchoAsCalibratedLabel', { defaultValue: 'MHI-calibrated screening label' })}
            {': '}
          </span>
          <span className="text-sm font-bold text-white">
            {calibrated === 'Significant AS likely, severe possible'
              ? t('PanEchoAsCalibratedSevere', { defaultValue: 'Significant AS likely, severe possible' })
              : calibrated === 'Significant AS likely'
                ? t('PanEchoAsCalibratedSignificant', { defaultValue: 'Significant AS likely' })
                : t('PanEchoAsCalibratedNone', { defaultValue: 'No significant AS suspected' })}
          </span>
        </p>
      )}
      <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
        <div data-testid="echo-report-as-severe">
          <dt className="text-xs text-[#c5cbc5]">{t('PanEchoAsSevere', { defaultValue: 'P(severe AS)' })}</dt>
          <dd className="font-bold tabular-nums text-white">{pct(screening.pSevere)}</dd>
        </div>
        <div data-testid="echo-report-as-any">
          <dt className="text-xs text-[#c5cbc5]">{t('PanEchoAsAny', { defaultValue: 'P(any AS)' })}</dt>
          <dd className="font-bold tabular-nums text-white">{pct(screening.pAny)}</dd>
        </div>
        <div data-testid="echo-report-as-vmax">
          <dt className="text-xs text-[#c5cbc5]">
            {screening.vmaxUncorrected === null
              ? t('PanEchoAvVmaxEstimate', { defaultValue: 'AV peak velocity (AI estimate)' })
              : t('PanEchoAvVmaxCalibrated', { defaultValue: 'AV peak velocity (AI estimate, MHI-calibrated)' })}
          </dt>
          <dd className="font-bold tabular-nums text-white">{vmax}</dd>
          {screening.vmaxUncorrected !== null && (
            <dd className="text-xs text-[#c5cbc5]" data-testid="echo-report-as-vmax-uncorrected">
              {t('PanEchoAvVmaxUncorrected', {
                defaultValue: 'uncorrected model output {{value}} m/s',
                value: formatNumber(screening.vmaxUncorrected, 1, lang),
              })}
            </dd>
          )}
        </div>
        {isEchoAlign && screening.pModerateOrSevere !== undefined && (
          <div data-testid="echo-report-as-moderate-or-severe">
            <dt className="text-xs text-[#c5cbc5]">
              {t('EchoReportAsModerateOrSevere', { defaultValue: 'P(moderate or severe AS), released classifier' })}
            </dt>
            <dd className="font-bold tabular-nums text-white">
              {pct(screening.pModerateOrSevere)}
              {screening.threshold !== null && screening.threshold !== undefined
                ? ` (${ECHO_REPORT_CONFIG.strings.threshold[lang]} ${formatPercent(screening.threshold)})`
                : ''}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-1 text-xs leading-5 text-amber-100" data-testid="echo-report-as-note">
        {isEchoAlign
          ? t('EchoAlignAsScreeningNote', {
              defaultValue:
                'Screening scores, not a diagnosis. EchoAlign reads the 2D and colour clips, without the Doppler spectra: the AV peak velocity and gradients are AI estimates compressed towards the middle of the range, and on MHI the severe grade was never called. Use the measured Doppler values (Vmax, mean gradient, valve area).',
            })
          : calibrated
            ? t('PanEchoAsCalibratedNote', {
                defaultValue:
                  "Screening label, not a diagnosis. 'Significant AS likely' means moderate or severe aortic stenosis is likely; the threshold and the AV peak velocity correction were fitted on MHI echos only (MHI locked test: sensitivity 0.81, specificity 0.91 against echos without AS). PanEcho reads the 2D clips only, without the Doppler spectra, and a negative label does not rule out aortic stenosis. Use the measured Doppler values (Vmax, mean gradient, valve area).",
              })
            : t('PanEchoAsScreeningNote', {
                defaultValue:
                  'Screening scores, not a diagnosis. PanEcho reads the 2D clips only, without the Doppler spectra: the AV peak velocity is an AI estimate that under-estimates severe AS, and a low score does not rule out aortic stenosis. Use the measured Doppler values (Vmax, mean gradient, valve area).',
              })}
      </p>
    </div>
  );
}

function SectionView({ section, model }: { section: ReportSection; model: string | null }) {
  const { t } = useTranslation('StudyList');
  const lang = useLang();
  const isValve = section.group === 'valves';
  return (
    <section
      aria-labelledby={`echo-report-section-${section.id}-title`}
      data-testid={`echo-report-section-${section.id}`}
      className={isValve ? 'ml-3 border-l border-white/10 pl-3' : ''}
    >
      <h4
        id={`echo-report-section-${section.id}-title`}
        className="mb-2 text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
      >
        {section.title[lang]}
      </h4>
      {section.measuredGrade && <MeasuredGrade grade={section.measuredGrade} />}
      {section.measured.length > 0 && (
        <dl
          className="mb-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-[#78b7f5]/30 bg-[#78b7f5]/[0.05] px-3 py-2 text-sm sm:grid-cols-2"
          data-testid={`echo-report-measured-${section.id}`}
        >
          {section.measured.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="flex min-w-0 justify-between gap-2"
              data-testid="echo-report-measured-row"
            >
              <dt className="min-w-0 break-words text-xs text-[#c5cbc5]">
                {lang === 'fr' && row.labelFr ? row.labelFr : row.label}
              </dt>
              <dd className="shrink-0 font-bold tabular-nums text-white">{row.display}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <SourceTag source="measured" />
          </div>
        </dl>
      )}
      {section.asScreening && <AsScreeningBlock screening={section.asScreening} model={model} />}
      {section.ai.length > 0 && (
        <dl
          className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm sm:grid-cols-2"
          data-testid={`echo-report-ai-${section.id}`}
        >
          {section.ai.map(row => {
            const detail = aiRowDetail(row, lang);
            return (
              <div
                key={row.key}
                className={`flex min-w-0 justify-between gap-2 ${row.flagged ? 'rounded bg-amber-500/15 px-1' : ''}`}
                data-testid="echo-report-ai-row"
                data-flagged={row.flagged ? 'true' : 'false'}
              >
                <dt className="min-w-0 break-words text-xs text-[#c5cbc5]">{row.label[lang]}</dt>
                <dd className={`shrink-0 text-right tabular-nums ${row.flagged ? 'font-bold text-amber-200' : 'font-semibold text-white'}`}>
                  {row.display === 'called'
                    ? t('EchoReportCalled', { defaultValue: 'Flagged' })
                    : row.display === 'not called'
                      ? t('EchoReportNotCalled', { defaultValue: 'Not flagged' })
                      : row.display}
                  {detail && <span className="block text-[10px] font-normal text-[#c5cbc5]">{detail}</span>}
                </dd>
              </div>
            );
          })}
          <div className="sm:col-span-2">
            <SourceTag source="ai" />
          </div>
        </dl>
      )}
      {section.notes.map((note, index) => (
        <p
          key={index}
          className="mt-2 rounded border border-amber-400/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100"
          data-testid="echo-report-discordance"
        >
          {note[lang]}
        </p>
      ))}
    </section>
  );
}

export function EchoStructuredReportView({ report }: EchoStructuredReportViewProps) {
  const lang = useLang();
  const strings = ECHO_REPORT_CONFIG.strings;
  const groups = ECHO_REPORT_CONFIG.groups as Record<string, { en: string; fr: string }>;
  let valvesShown = false;
  return (
    <div
      className="space-y-4"
      data-testid="echo-structured-report"
      data-thresholds-version={report.thresholdsVersion}
    >
      {report.sections.map(section => {
        const header =
          section.group === 'valves' && !valvesShown ? (
            <h4
              key="valves-header"
              className="text-xs font-bold uppercase tracking-wide text-[#78b7f5]"
              data-testid="echo-report-group-valves"
            >
              {groups.valves[lang]}
            </h4>
          ) : null;
        if (section.group === 'valves') {
          valvesShown = true;
        }
        return (
          <React.Fragment key={section.id}>
            {header}
            <SectionView section={section} model={report.model} />
          </React.Fragment>
        );
      })}

      <section
        aria-labelledby="echo-report-conclusion-title"
        className="rounded-lg border border-[#3ef1d1]/40 bg-[#3ef1d1]/[0.05] px-4 py-3"
        data-testid="echo-report-conclusion"
      >
        <h4
          id="echo-report-conclusion-title"
          className="mb-2 text-xs font-bold uppercase tracking-wide text-[#3ef1d1]"
        >
          {strings.conclusionTitle[lang]}
        </h4>
        {report.conclusion.length === 0 ? (
          <p className="text-sm font-semibold text-white" data-testid="echo-report-no-abnormality">
            {report.noAbnormalityText[lang]}
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-white">
            {report.conclusion.map((item, index) => (
              <li
                key={`${item.concept}-${index}`}
                data-testid="echo-report-conclusion-item"
                data-source={item.source}
                data-structure={item.structure}
              >
                <span className="font-bold">{item.structureLabel[lang]}</span>
                {' — '}
                {item.text[lang]}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-[#c5cbc5]">
          {report.hasMeasured ? `${strings.measuredSource[lang]} ` : ''}
          {report.hasMeasured && report.sexUnknown ? strings.sexUnknown[lang] : ''}
        </p>
      </section>
    </div>
  );
}

export default EchoStructuredReportView;
