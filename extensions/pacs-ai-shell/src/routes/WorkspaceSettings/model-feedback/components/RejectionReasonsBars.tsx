import React from 'react';
import { useTranslation } from 'react-i18next';
import { FEEDBACK_COLORS } from './dashboardTheme';

type RejectionReasonsBarsProps = {
  reasons: { id: string; count: number }[];
  reasonLabel: (id: string) => string;
};

/** Thumbs-down reasons from the default questionnaire, one bar each. */
const RejectionReasonsBars = ({ reasons, reasonLabel }: RejectionReasonsBarsProps) => {
  const { t } = useTranslation('ModelFeedback');
  const max = Math.max(0, ...reasons.map(reason => reason.count));

  if (max === 0) {
    return (
      <p
        className="text-white/55 mt-6 text-sm"
        data-testid="model-feedback-reasons-empty"
      >
        {t('No thumbs down in this period')}
      </p>
    );
  }

  return (
    <ul
      className="mt-4 space-y-2.5"
      data-testid="model-feedback-reasons"
    >
      {reasons.map(reason => (
        <li
          key={reason.id}
          data-testid="model-feedback-reason"
        >
          <div className="text-[13px] text-white/80">{reasonLabel(reason.id)}</div>
          <div className="mt-1 flex h-[20px] items-center gap-3">
            {reason.count > 0 && (
              <div
                className="h-full shrink-0 rounded-r"
                style={{
                  width: `calc((100% - 3rem) * ${reason.count / max})`,
                  background: FEEDBACK_COLORS.up,
                }}
              />
            )}
            <span className="text-white/85 shrink-0 text-[13px] tabular-nums">{reason.count}</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default RejectionReasonsBars;
