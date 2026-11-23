import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardModelRow } from '../feedbackDashboardModel';
import { areaPath, isolatedIndexes, linePath, linearScale } from './chartMath';
import {
  FEEDBACK_COLORS,
  deltaClassName,
  formatDelta,
  formatPercent,
  useMeasuredWidth,
} from './dashboardTheme';

type ModelApprovalPanelsProps = {
  models: DashboardModelRow[];
  scale: { min: number; max: number };
};

const SPARK_HEIGHT = 64;

function Sparkline({
  model,
  scale,
}: {
  model: DashboardModelRow;
  scale: { min: number; max: number };
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(260);
  const color = model.belowThreshold ? FEEDBACK_COLORS.down : FEEDBACK_COLORS.up;
  const values = model.weeklyRate;
  const pad = 6;
  const x = (index: number) =>
    pad +
    (values.length > 1 ? ((width - pad * 2) * index) / (values.length - 1) : (width - pad * 2) / 2);
  const y = linearScale([scale.min, scale.max], [SPARK_HEIGHT - 2, 4]);
  const points = values.map((value, index) => ({
    x: x(index),
    y: value === null ? null : y(value * 100),
  }));
  const last = values.reduce<number>((found, value, index) => (value === null ? found : index), -1);

  return (
    <div
      ref={ref}
      className="mt-3 w-full"
    >
      <svg
        width={width}
        height={SPARK_HEIGHT}
        aria-hidden="true"
        data-testid="model-feedback-sparkline"
      >
        <rect
          x={pad}
          y={y(scale.max)}
          width={Math.max(0, width - pad * 2)}
          height={SPARK_HEIGHT - 2 - y(scale.max)}
          fill={color}
          opacity={0.06}
        />
        <path
          d={areaPath(points, SPARK_HEIGHT - 2)}
          fill={color}
          opacity={0.1}
        />
        <path
          d={linePath(points)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {isolatedIndexes(values)
          .filter(index => index !== last)
          .map(index => (
            <circle
              key={index}
              cx={points[index].x}
              cy={points[index].y ?? 0}
              r={2.5}
              fill={color}
            />
          ))}
        {last >= 0 && (
          <circle
            cx={points[last].x}
            cy={points[last].y ?? 0}
            r={4}
            fill={color}
            stroke={FEEDBACK_COLORS.surface}
            strokeWidth={2}
          />
        )}
      </svg>
    </div>
  );
}

/** One sparkline per model on a shared scale, highest volume first. */
const ModelApprovalPanels = ({ models, scale }: ModelApprovalPanelsProps) => {
  const { t } = useTranslation('ModelFeedback');

  return (
    <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
      {models.map(model => (
        <div
          key={model.inferenceModelId}
          className="min-w-0"
          data-testid="model-feedback-model-panel"
          role="img"
          aria-label={t('{{model}} approval {{rate}} from {{count}} ratings', {
            model: model.name,
            rate: formatPercent(model.rate),
            count: model.up + model.down,
          })}
        >
          <div className="flex items-baseline gap-2 truncate text-[15px] text-white">
            <span className="truncate">{model.name}</span>
            {model.versions.length > 0 && (
              <span className="shrink-0 text-[11px] text-white/40">
                {model.versions.length === 1
                  ? `v${model.versions[0]}`
                  : t('{{count}} versions', { count: model.versions.length })}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-[24px] leading-none ${model.belowThreshold ? 'text-[#F2777B]' : 'text-white'}`}
              data-testid="model-feedback-model-rate"
            >
              {formatPercent(model.rate)}
            </span>
            <span className={`text-[12px] ${deltaClassName(model.deltaPts)}`}>
              {model.deltaPts === null
                ? t('{{count}} ratings', { count: model.up + model.down })
                : t('{{delta}} pts', { delta: formatDelta(model.deltaPts) })}
            </span>
          </div>
          <Sparkline
            model={model}
            scale={scale}
          />
        </div>
      ))}
    </div>
  );
};

export default ModelApprovalPanels;
