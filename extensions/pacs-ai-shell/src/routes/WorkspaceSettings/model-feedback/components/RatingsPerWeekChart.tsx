import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardWeek } from '../feedbackDashboardModel';
import { linearScale, niceStep, ticks } from './chartMath';
import {
  FEEDBACK_COLORS,
  barPath,
  formatPercent,
  shortDate,
  useMeasuredWidth,
} from './dashboardTheme';

type RatingsPerWeekChartProps = {
  weeks: DashboardWeek[];
};

const HEIGHT = 320;
const MARGIN = { top: 24, right: 12, bottom: 30, left: 40 };
const MAX_BAR = 28;

/**
 * Weekly thumbs up above the baseline and thumbs down below it, so polarity
 * reads from position before colour.
 */
const RatingsPerWeekChart = ({ weeks }: RatingsPerWeekChartProps) => {
  const { t, i18n } = useTranslation('ModelFeedback');
  const language = i18n?.language;
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const maxUp = Math.max(0, ...weeks.map(week => week.up));
  const maxDown = Math.max(0, ...weeks.map(week => week.down));
  const step = niceStep(Math.max(maxUp, maxDown, 4), 7);
  const top = Math.max(step, Math.ceil(maxUp / step) * step);
  // With no thumbs down the chart keeps only the baseline below the bars.
  const bottom = maxDown > 0 ? Math.ceil(maxDown / step) * step : 0;

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const y = linearScale([-bottom, top], [HEIGHT - MARGIN.bottom - (bottom ? 0 : 12), MARGIN.top]);
  const baseline = y(0);
  const band = weeks.length ? plotWidth / weeks.length : plotWidth;
  const barWidth = Math.max(4, Math.min(MAX_BAR, band * 0.55));
  // About one date label per 80px, at most seven.
  const labelEvery = Math.max(
    1,
    Math.ceil(weeks.length / Math.max(2, Math.min(7, Math.floor(plotWidth / 80))))
  );
  const centre = (index: number) => MARGIN.left + band * index + band / 2;

  // Label the latest week with ratings, at its bar ends.
  let labelIndex = -1;
  for (let index = weeks.length - 1; index >= 0; index--) {
    if (weeks[index].up + weeks[index].down > 0) {
      labelIndex = index;
      break;
    }
  }

  const totalUp = weeks.reduce((sum, week) => sum + week.up, 0);
  const totalDown = weeks.reduce((sum, week) => sum + week.down, 0);
  const summary = t(
    'Ratings per week, {{up}} thumbs up and {{down}} thumbs down over {{count}} weeks',
    {
      up: totalUp,
      down: totalDown,
      count: weeks.length,
    }
  );
  const hovered = hover === null ? null : weeks[hover];

  return (
    <div
      ref={ref}
      className="relative w-full"
    >
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={summary}
        data-testid="model-feedback-weekly-chart"
        onMouseLeave={() => setHover(null)}
      >
        {ticks(-bottom, top, step).map(value => (
          <g key={value}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(value)}
              y2={y(value)}
              stroke={value === 0 ? 'rgba(255,255,255,0.25)' : FEEDBACK_COLORS.grid}
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 10}
              y={y(value)}
              dy="0.32em"
              textAnchor="end"
              fontSize={12}
              fill={FEEDBACK_COLORS.axis}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {Math.abs(value)}
            </text>
          </g>
        ))}

        {weeks.map((week, index) => {
          const x = centre(index) - barWidth / 2;
          const dim = hover !== null && hover !== index;
          return (
            <g
              key={week.start.toISOString()}
              opacity={dim ? 0.55 : 1}
            >
              {week.up > 0 && (
                <path
                  d={barPath(x, barWidth, baseline - 1, y(week.up))}
                  fill={FEEDBACK_COLORS.up}
                  data-testid="model-feedback-weekly-up"
                />
              )}
              {week.down > 0 && (
                <path
                  d={barPath(x, barWidth, baseline + 1, y(-week.down))}
                  fill={FEEDBACK_COLORS.down}
                  data-testid="model-feedback-weekly-down"
                />
              )}
              {index === labelIndex && week.up > 0 && (
                <text
                  x={centre(index)}
                  y={y(week.up) - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fill="rgba(255,255,255,0.9)"
                >
                  {week.up}
                </text>
              )}
              {index === labelIndex && week.down > 0 && (
                <text
                  x={centre(index)}
                  y={y(-week.down) + 16}
                  textAnchor="middle"
                  fontSize={12}
                  fill="rgba(255,255,255,0.9)"
                >
                  {week.down}
                </text>
              )}
              {(weeks.length - 1 - index) % labelEvery === 0 && (
                <text
                  x={centre(index)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fill={FEEDBACK_COLORS.axis}
                >
                  {shortDate(week.end, language)}
                </text>
              )}
              <rect
                x={MARGIN.left + band * index}
                y={MARGIN.top}
                width={band}
                height={HEIGHT - MARGIN.top - MARGIN.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
            </g>
          );
        })}
      </svg>

      {hovered && hover !== null && (
        <div
          className="border-white/15 pointer-events-none absolute z-10 rounded-lg border bg-[#232823] px-3 py-2 text-xs text-white shadow-lg"
          style={{
            left: Math.min(Math.max(centre(hover) - 80, 0), Math.max(0, width - 170)),
            top: 0,
            width: 170,
          }}
          role="status"
        >
          <div className="text-white/60">
            {t('Week ending {{date}}', { date: shortDate(hovered.end, language) })}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: FEEDBACK_COLORS.up }}
            />
            {t('{{count}} thumbs up', { count: hovered.up })}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: FEEDBACK_COLORS.down }}
            />
            {t('{{count}} thumbs down', { count: hovered.down })}
          </div>
          <div className="mt-1 text-white/60">
            {t('Approval {{rate}}', { rate: formatPercent(hovered.rate) })}
          </div>
        </div>
      )}

      <div className="sr-only">
        <table>
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th>{t('Week ending')}</th>
              <th>{t('Thumbs up')}</th>
              <th>{t('Thumbs down')}</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(week => (
              <tr key={week.start.toISOString()}>
                <td>{shortDate(week.end, language)}</td>
                <td>{week.up}</td>
                <td>{week.down}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** The legend shown in the card header. */
export const RatingsPerWeekLegend = () => {
  const { t } = useTranslation('ModelFeedback');
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-white/80">
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: FEEDBACK_COLORS.up }}
        />
        {t('Thumbs up (above)')}
      </span>
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ background: FEEDBACK_COLORS.down }}
        />
        {t('Thumbs down (below)')}
      </span>
    </div>
  );
};

export default RatingsPerWeekChart;
