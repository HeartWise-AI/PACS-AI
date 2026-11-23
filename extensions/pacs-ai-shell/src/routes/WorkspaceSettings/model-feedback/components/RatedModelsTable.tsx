import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardModelRow } from '../feedbackDashboardModel';
import { FEEDBACK_COLORS, formatPercent, relativeTime } from './dashboardTheme';

type RatedModelsTableProps = {
  models: DashboardModelRow[];
  reasonLabel: (id: string) => string;
  now: Date;
};

const headClassName = 'px-3 py-2 text-[12px] font-medium uppercase tracking-[0.08em] text-white/55';

/** Every rated model: votes, approval, top rejection reason and last rating. */
const RatedModelsTable = ({ models, reasonLabel, now }: RatedModelsTableProps) => {
  const { t, i18n } = useTranslation('ModelFeedback');

  return (
    <div className="ohif-scrollbar mt-3 overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm text-white">
        <thead>
          <tr className="border-b border-white/10">
            <th className={`${headClassName} pl-0`}>{t('Model')}</th>
            <th className={`${headClassName} text-right`}>{t('Up')}</th>
            <th className={`${headClassName} text-right`}>{t('Down')}</th>
            <th className={headClassName}>{t('Approval rate')}</th>
            <th className={headClassName}>{t('Top rejection reason')}</th>
            <th className={`${headClassName} pr-0 text-right`}>{t('Last rated')}</th>
          </tr>
        </thead>
        <tbody>
          {models.map(model => {
            const below = model.belowThreshold;
            return (
              <tr
                key={model.inferenceModelId}
                className="border-b border-white/[0.06] last:border-b-0"
                data-testid="model-feedback-model-row"
              >
                <td className="py-3 pl-0 pr-3">
                  <span className="text-white">{model.name}</span>
                  {model.versions.length > 0 && (
                    <span className="ml-2 text-[11px] text-white/40">
                      {model.versions.map(version => `v${version}`).join(', ')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{model.up}</td>
                <td className="px-3 py-3 text-right tabular-nums">{model.down}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-4">
                    <div
                      className="h-[7px] w-[160px] shrink-0 overflow-hidden rounded-full"
                      style={{ background: 'rgba(141,182,28,0.22)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(model.rate ?? 0) * 100}%`,
                          background: below ? FEEDBACK_COLORS.down : FEEDBACK_COLORS.up,
                        }}
                      />
                    </div>
                    <span
                      className={`w-[72px] text-right tabular-nums ${below ? 'text-[#F2777B]' : 'text-white/90'}`}
                    >
                      {below ? '▼ ' : ''}
                      {formatPercent(model.rate)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-white/90">
                  {model.topReasonId ? reasonLabel(model.topReasonId) : '—'}
                </td>
                <td className="py-3 pl-3 pr-0 text-right text-[13px] text-white/60">
                  {relativeTime(model.lastRatedAt, now, i18n?.language)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RatedModelsTable;
