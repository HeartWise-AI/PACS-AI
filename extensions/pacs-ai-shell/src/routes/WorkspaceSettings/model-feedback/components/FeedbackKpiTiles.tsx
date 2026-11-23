import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedbackDashboard } from '../feedbackDashboardModel';
import { deltaClassName, formatDelta, formatPercent } from './dashboardTheme';

type FeedbackKpiTilesProps = {
  kpis: FeedbackDashboard['kpis'];
  // "90 days", already translated.
  period: string;
};

const tileClassName =
  'flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4';
const labelClassName = 'text-[13px] uppercase tracking-[0.08em] text-white/60';
const captionClassName = 'mt-1 text-[13px] text-white/55';

function Delta({ text, value, testId }: { text: string; value: number | null; testId: string }) {
  return (
    <div
      className={`mt-1 text-sm ${deltaClassName(value)}`}
      data-testid={testId}
    >
      {text}
    </div>
  );
}

/** The four headline numbers above the charts. */
const FeedbackKpiTiles = ({ kpis, period }: FeedbackKpiTilesProps) => {
  const { t } = useTranslation('ModelFeedback');
  const noPrior = t('No ratings in the prior {{period}}', { period });

  const ptsDelta = (value: number | null) =>
    value === null
      ? noPrior
      : t('{{delta}} pts vs prior {{period}}', { delta: formatDelta(value), period });

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]"
      data-testid="model-feedback-kpis"
    >
      <div
        className={tileClassName}
        data-testid="model-feedback-kpi-approval"
      >
        <span className={labelClassName}>{t('Approval rate')}</span>
        <span className="mt-1 text-[48px] font-medium leading-none text-[#C8F469]">
          {formatPercent(kpis.approvalRate)}
        </span>
        <Delta
          text={ptsDelta(kpis.approvalDeltaPts)}
          value={kpis.approvalDeltaPts}
          testId="model-feedback-kpi-approval-delta"
        />
        <span className={captionClassName}>{t('Share of ratings that were thumbs up')}</span>
      </div>

      <div
        className={tileClassName}
        data-testid="model-feedback-kpi-total"
      >
        <span className={labelClassName}>{t('Total ratings')}</span>
        <span className="mt-2 text-[34px] font-medium leading-none text-white">
          {kpis.total.toLocaleString()}
        </span>
        <Delta
          text={
            kpis.totalDeltaPct === null
              ? noPrior
              : t('{{delta}}% vs prior {{period}}', {
                  delta: formatDelta(kpis.totalDeltaPct, 0),
                  period,
                })
          }
          value={kpis.totalDeltaPct}
          testId="model-feedback-kpi-total-delta"
        />
        <span className={captionClassName}>
          {t('{{up}} up · {{down}} down', {
            up: kpis.up.toLocaleString(),
            down: kpis.down.toLocaleString(),
          })}
        </span>
      </div>

      <div
        className={tileClassName}
        data-testid="model-feedback-kpi-models"
      >
        <span className={labelClassName}>{t('Models rated')}</span>
        <span className="mt-2 text-[34px] font-medium leading-none text-white">
          {kpis.modelsRated}
        </span>
        <span className="mt-1 text-sm text-white/80">
          {t('of {{count}} deployed', { count: kpis.modelsDeployed })}
        </span>
        <span className={captionClassName}>
          {kpis.modelsUnrated > 0
            ? t('{{count}} models have no ratings yet', { count: kpis.modelsUnrated })
            : t('Every deployed model has ratings')}
        </span>
      </div>

      <div
        className={tileClassName}
        data-testid="model-feedback-kpi-reports"
      >
        <span className={labelClassName}>{t('Reports rated')}</span>
        <span className="mt-2 text-[34px] font-medium leading-none text-white">
          {formatPercent(kpis.reportsRatedPct)}
        </span>
        <Delta
          text={
            kpis.reportsReturned === null
              ? t('Reports returned unavailable')
              : ptsDelta(kpis.reportsDeltaPts)
          }
          value={kpis.reportsReturned === null ? null : kpis.reportsDeltaPts}
          testId="model-feedback-kpi-reports-delta"
        />
        <span className={captionClassName}>
          {kpis.reportsReturned === null
            ? t('{{count}} reports rated', { count: kpis.reportsRated.toLocaleString() })
            : t('{{rated}} of {{returned}} reports returned', {
                rated: kpis.reportsRated.toLocaleString(),
                returned: kpis.reportsReturned.toLocaleString(),
              })}
        </span>
      </div>
    </div>
  );
};

export default FeedbackKpiTiles;
