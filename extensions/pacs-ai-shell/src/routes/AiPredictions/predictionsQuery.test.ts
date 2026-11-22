import {
  availableViews,
  buildPredictionsFilterParams,
  buildPredictionsListParams,
  DEFAULT_PREDICTIONS_FILTERS,
  predictionsDateRange,
  updatePredictionsFilters,
} from './predictionsQuery';
import type { PredictionsFilters } from './types';

const NOW = new Date(2026, 10, 16, 15, 30);
const filters = (change: Partial<PredictionsFilters> = {}): PredictionsFilters => ({
  ...DEFAULT_PREDICTIONS_FILTERS,
  ...change,
});

describe('AI predictions query parameters', () => {
  test('default is my runs over the last 7 days, first page', () => {
    expect(buildPredictionsListParams(filters(), NOW)).toEqual({
      view: 'mine',
      from: new Date(NOW.getTime() - 7 * 24 * 3600 * 1000).toISOString(),
      limit: '25',
      offset: '0',
    });
  });

  test('filters map to the gateway parameters', () => {
    expect(
      buildPredictionsListParams(
        filters({
          view: 'automatic',
          search: '  SYN-ACC ',
          model: 'PanEcho',
          status: 'attention',
          modality: 'US',
          date: 'today',
          page: 2,
        }),
        NOW
      )
    ).toEqual({
      view: 'automatic',
      q: 'SYN-ACC',
      model: 'PanEcho',
      status: 'attention',
      modality: 'US',
      from: new Date(2026, 10, 16).toISOString(),
      limit: '25',
      offset: '50',
    });
    expect(buildPredictionsFilterParams(filters({ date: 'any' }), NOW)).toEqual({ view: 'mine' });
  });

  test('"Launched by" is sent in the all view only', () => {
    expect(
      buildPredictionsFilterParams(
        filters({ view: 'mine', launchedBy: 'user:u-2', date: 'any' }),
        NOW
      )
    ).toEqual({
      view: 'mine',
    });
    expect(
      buildPredictionsFilterParams(
        filters({ view: 'all', launchedBy: 'user:u-2', date: 'any' }),
        NOW
      )
    ).toEqual({ view: 'all', launchedBy: 'user:u-2' });
    expect(
      buildPredictionsFilterParams(filters({ view: 'all', launchedBy: 'any', date: 'any' }), NOW)
    ).toEqual({
      view: 'all',
    });
  });

  test('custom range includes the end day and refuses reversed or empty ranges', () => {
    const range = predictionsDateRange(
      filters({ date: 'custom', customFrom: '2026-11-01', customTo: '2026-11-03' }),
      NOW
    );
    expect(range).toEqual({
      from: new Date(2026, 10, 1),
      to: new Date(2026, 10, 4),
      invalid: false,
    });
    expect(
      predictionsDateRange(
        filters({ date: 'custom', customFrom: '2026-11-05', customTo: '2026-11-03' }),
        NOW
      ).invalid
    ).toBe(true);
    expect(predictionsDateRange(filters({ date: 'custom' }), NOW).invalid).toBe(true);
    expect(
      predictionsDateRange(filters({ date: 'custom', customFrom: '2026-02-30' }), NOW).invalid
    ).toBe(true);
    expect(
      buildPredictionsFilterParams(filters({ date: 'custom', customTo: '2026-11-03' }), NOW)
    ).toEqual({
      view: 'mine',
      to: new Date(2026, 10, 4).toISOString(),
    });
  });

  test('changing a filter returns to the first page; leaving "all" resets "Launched by"', () => {
    const current = filters({ view: 'all', launchedBy: 'automatic', page: 3 });
    expect(updatePredictionsFilters(current, { status: 'active' })).toMatchObject({
      page: 0,
      launchedBy: 'automatic',
    });
    expect(updatePredictionsFilters(current, { view: 'mine' })).toMatchObject({
      page: 0,
      launchedBy: 'any',
    });
    expect(updatePredictionsFilters(current, { page: 4 })).toMatchObject({ page: 4 });
  });

  test('the all view is offered to workspace administrators only', () => {
    expect(availableViews(false)).toEqual(['mine', 'automatic']);
    expect(availableViews(true)).toEqual(['mine', 'automatic', 'all']);
  });
});
