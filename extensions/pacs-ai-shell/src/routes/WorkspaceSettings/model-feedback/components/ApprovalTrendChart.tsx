import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardWeek } from '../feedbackDashboardModel';
import { areaPath, isolatedIndexes, linePath, linearScale, ticks } from './chartMath';
import { FEEDBACK_COLORS, formatPercent, shortDate, useMeasuredWidth } from './dashboardTheme';

type ApprovalTrendChartProps = {
  weeks: DashboardWeek[];
  // 0–1.
  threshold: number;
};

const HEIGHT = 290;
const MARGIN = { top: 28, right: 20, bottom: 30, left: 44 };

/** The trend's percent domain: always shows the threshold, in 10-point steps. */
export function trendDomain(rates: number[], threshold: number): [number, number] {
  const values = rates.map(rate => rate * 100);
  const thresholdPct = threshold * 100;
  const low = Math.min(thresholdPct - 10, ...values);
  const high = Math.max(thresholdPct + 10, ...values);
  return [Math.max(0, Math.floor(low / 10) * 10), Math.min(100, Math.ceil((high + 3) / 10) * 10)];
}

/** Weekly approval, all models combined, against the review threshold. */
const ApprovalTrendChart = ({ weeks, threshold }: ApprovalTrendChartProps) => {
  const { t, i18n } = useTranslation('ModelFeedback');
  const language = i18n?.language;
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(600);
  const [hover, setHover] = useState<number | null>(null);

  const rates = weeks.map(week => week.rate);
  const known = rates.filter((rate): rate is number => rate !== null);
  const [min, max] = trendDomain(known, threshold);
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const x = (index: number) =>
    MARGIN.left + (weeks.length > 1 ? (plotWidth * index) / (weeks.length - 1) : plotWidth / 2);
  const y = linearScale([min, max], [HEIGHT - MARGIN.bottom, MARGIN.top]);
  const points = rates.map((rate, index) => ({
    x: x(index),
    y: rate === null ? null : y(rate * 100),
  }));
  const bottom = HEIGHT - MARGIN.bottom;
  const lastIndex = rates.reduce<number>((last, rate, index) => (rate === null ? last : index), -1);
  const labelEvery = Math.max(
    1,
    Math.ceil(weeks.length / Math.max(2, Math.min(5, Math.floor(plotWidth / 80))))
  );
  const thresholdY = y(threshold * 100);

  const summary =
    lastIndex >= 0
      ? t('Approval rate trend, latest week {{rate}}, review threshold {{threshold}}', {
          rate: formatPercent(rates[lastIndex]),
          threshold: formatPercent(threshold, 0),
        })
      : t('Approval rate trend, no ratings in this period');

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!weeks.length) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const offset = event.clientX - box.left - MARGIN.left;
    const index = Math.round((offset / Math.max(plotWidth, 1)) * (weeks.length - 1));
    setHover(Math.min(weeks.length - 1, Math.max(0, index)));
  };

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
        data-testid="model-feedback-trend-chart"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient
            id="model-feedback-trend-fill"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor={FEEDBACK_COLORS.up}
              stopOpacity={0.16}
            />
            <stop
              offset="100%"
              stopColor={FEEDBACK_COLORS.up}
              stopOpacity={0.06}
            />
          </linearGradient>
        </defs>
        {ticks(min, max, 10).map(value => (
          <g key={value}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(value)}
              y2={y(value)}
              stroke={FEEDBACK_COLORS.grid}
            />
            <text
              x={MARGIN.left - 10}
              y={y(value)}
              dy="0.32em"
              textAnchor="end"
              fontSize={12}
              fill={FEEDBACK_COLORS.axis}
            >
              {value}%
            </text>
          </g>
        ))}

        <path
          d={areaPath(points, bottom)}
          fill="url(#model-feedback-trend-fill)"
        />
        <line
          x1={MARGIN.left}
          x2={width - MARGIN.right}
          y1={thresholdY}
          y2={thresholdY}
          stroke={FEEDBACK_COLORS.threshold}
          strokeDasharray="4 4"
          data-testid="model-feedback-threshold"
        />
        <text
          x={MARGIN.left + 8}
          y={thresholdY - 7}
          fontSize={12}
          fill="rgba(255,255,255,0.6)"
          stroke={FEEDBACK_COLORS.surface}
          strokeWidth={4}
          paintOrder="stroke"
        >
          {t('{{threshold}} threshold', { threshold: formatPercent(threshold, 0) })}
        </text>
        <path
          d={linePath(points)}
          fill="none"
          stroke={FEEDBACK_COLORS.up}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {isolatedIndexes(rates)
          .filter(index => index !== lastIndex)
          .map(index => (
            <circle
              key={index}
              cx={points[index].x}
              cy={points[index].y ?? 0}
              r={3}
              fill={FEEDBACK_COLORS.up}
            />
          ))}
        {lastIndex >= 0 && (
          <g>
            <circle
              cx={points[lastIndex].x}
              cy={points[lastIndex].y ?? 0}
              r={5}
              fill={FEEDBACK_COLORS.up}
              stroke={FEEDBACK_COLORS.surface}
              strokeWidth={2}
            />
            <text
              x={points[lastIndex].x}
              y={(points[lastIndex].y ?? 0) - 12}
              textAnchor={lastIndex === weeks.length - 1 ? 'end' : 'middle'}
              fontSize={13}
              fill="rgba(255,255,255,0.92)"
            >
              {formatPercent(rates[lastIndex])}
            </text>
          </g>
        )}
        {weeks.map((week, index) =>
          (weeks.length - 1 - index) % labelEvery === 0 ? (
            <text
              key={week.start.toISOString()}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor={index === weeks.length - 1 ? 'end' : index === 0 ? 'start' : 'middle'}
              fontSize={12}
              fill={FEEDBACK_COLORS.axis}
            >
              {shortDate(week.end, language)}
            </text>
          ) : null
        )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={MARGIN.top}
            y2={bottom}
            stroke="rgba(255,255,255,0.3)"
          />
        )}
      </svg>
      {hovered && hover !== null && (
        <div
          className="border-white/15 pointer-events-none absolute z-10 rounded-lg border bg-[#232823] px-3 py-2 text-xs text-white shadow-lg"
          style={{
            left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, width - 150)),
            top: 0,
            width: 150,
          }}
          role="status"
        >
          <div className="text-white/60">
            {t('Week ending {{date}}', { date: shortDate(hovered.end, language) })}
          </div>
          <div className="mt-1">
            {t('Approval {{rate}}', { rate: formatPercent(hovered.rate) })}
          </div>
          <div className="text-white/60">
            {t('{{up}} up · {{down}} down', { up: hovered.up, down: hovered.down })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalTrendChart;
