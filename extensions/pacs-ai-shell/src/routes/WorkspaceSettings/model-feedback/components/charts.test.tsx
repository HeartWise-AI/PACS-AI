import React from 'react';
import { render } from '@testing-library/react';
import type { DashboardWeek } from '../feedbackDashboardModel';
import ApprovalTrendChart, { trendDomain } from './ApprovalTrendChart';
import RatingsPerWeekChart from './RatingsPerWeekChart';
import RejectionReasonsBars from './RejectionReasonsBars';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(options[name] ?? '')),
    i18n: { language: 'en-US' },
  }),
}));

function weeks(values: [number, number][]): DashboardWeek[] {
  return values.map(([up, down], index) => ({
    start: new Date(2026, 4, 5 + index * 7),
    end: new Date(2026, 4, 11 + index * 7),
    up,
    down,
    rate: up + down ? up / (up + down) : null,
  }));
}

describe('feedback charts', () => {
  test('ratings per week draws one bar per non-zero count and labels the totals', () => {
    const { getByTestId, getAllByTestId, queryAllByTestId } = render(
      <RatingsPerWeekChart
        weeks={weeks([
          [18, 9],
          [0, 0],
          [61, 10],
        ])}
      />
    );
    expect(getAllByTestId('model-feedback-weekly-up')).toHaveLength(2);
    expect(queryAllByTestId('model-feedback-weekly-down')).toHaveLength(2);
    expect(getByTestId('model-feedback-weekly-chart').getAttribute('aria-label')).toBe(
      'Ratings per week, 79 thumbs up and 19 thumbs down over 3 weeks'
    );
    expect(getByTestId('model-feedback-weekly-chart').getAttribute('role')).toBe('img');
  });

  test('the approval trend shows the threshold line and its label', () => {
    const { getByTestId, container } = render(
      <ApprovalTrendChart
        weeks={weeks([
          [6, 3],
          [8, 2],
          [9, 1],
        ])}
        threshold={0.75}
      />
    );
    expect(getByTestId('model-feedback-threshold')).toBeTruthy();
    expect(container.textContent).toContain('75% threshold');
    expect(getByTestId('model-feedback-trend-chart').getAttribute('aria-label')).toBe(
      'Approval rate trend, latest week 90.0%, review threshold 75%'
    );
  });

  test('the trend domain always contains the threshold', () => {
    expect(trendDomain([1, 1], 0.75)).toEqual([60, 100]);
    expect(trendDomain([0.67, 0.866], 0.75)).toEqual([60, 90]);
    expect(trendDomain([0.2], 0.75)).toEqual([20, 90]);
  });

  test('rejection reasons show an empty state with no thumbs down', () => {
    const { getByTestId } = render(
      <RejectionReasonsBars
        reasons={[{ id: 'other', count: 0 }]}
        reasonLabel={id => id}
      />
    );
    expect(getByTestId('model-feedback-reasons-empty').textContent).toBe(
      'No thumbs down in this period'
    );
  });
});
