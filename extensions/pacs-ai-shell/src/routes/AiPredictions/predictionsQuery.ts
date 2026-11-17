import type { PredictionsFilters, PredictionsView } from './types';

export const PREDICTIONS_PAGE_SIZE = 25;

export const DEFAULT_PREDICTIONS_FILTERS: PredictionsFilters = {
  view: 'mine',
  search: '',
  model: '',
  status: 'any',
  modality: '',
  date: '7d',
  customFrom: '',
  customTo: '',
  launchedBy: 'any',
  page: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight of a yyyy-mm-dd date input, or null. */
export function parseDateInput(value: string): Date | null {
  const match = DATE_INPUT.exec(value.trim());
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
}

function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export interface PredictionsDateRange {
  from: Date | null;
  to: Date | null;
  // A custom range that cannot be sent (missing or reversed dates).
  invalid: boolean;
}

export function predictionsDateRange(filters: PredictionsFilters, now: Date): PredictionsDateRange {
  switch (filters.date) {
    case 'today':
      return { from: startOfLocalDay(now), to: null, invalid: false };
    case '7d':
      return { from: new Date(now.getTime() - 7 * DAY_MS), to: null, invalid: false };
    case '30d':
      return { from: new Date(now.getTime() - 30 * DAY_MS), to: null, invalid: false };
    case 'custom': {
      const from = filters.customFrom ? parseDateInput(filters.customFrom) : null;
      const toDay = filters.customTo ? parseDateInput(filters.customTo) : null;
      // The end date is inclusive: the range stops at the next local midnight.
      const to = toDay
        ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1)
        : null;
      const invalid =
        (filters.customFrom !== '' && !from) ||
        (filters.customTo !== '' && !toDay) ||
        (!from && !to) ||
        (from !== null && to !== null && to.getTime() <= from.getTime());
      return { from, to, invalid };
    }
    default:
      return { from: null, to: null, invalid: false };
  }
}

export function availableViews(canViewAll: boolean): PredictionsView[] {
  return canViewAll ? ['mine', 'automatic', 'all'] : ['mine', 'automatic'];
}

/**
 * Query parameters shared by the list and the CSV export. The server enforces
 * the view rules; the client only avoids sending what it would refuse.
 */
export function buildPredictionsFilterParams(
  filters: PredictionsFilters,
  now: Date
): Record<string, string> {
  const params: Record<string, string> = { view: filters.view };
  const search = filters.search.trim();
  if (search) {
    params.q = search;
  }
  if (filters.model) {
    params.model = filters.model;
  }
  if (filters.status !== 'any') {
    params.status = filters.status;
  }
  if (filters.modality) {
    params.modality = filters.modality;
  }
  const range = predictionsDateRange(filters, now);
  if (!range.invalid) {
    if (range.from) {
      params.from = range.from.toISOString();
    }
    if (range.to) {
      params.to = range.to.toISOString();
    }
  }
  if (filters.view === 'all' && filters.launchedBy && filters.launchedBy !== 'any') {
    params.launchedBy = filters.launchedBy;
  }
  return params;
}

export function buildPredictionsListParams(
  filters: PredictionsFilters,
  now: Date,
  pageSize = PREDICTIONS_PAGE_SIZE
): Record<string, string> {
  return {
    ...buildPredictionsFilterParams(filters, now),
    limit: String(pageSize),
    offset: String(Math.max(0, filters.page) * pageSize),
  };
}

/** Changing any filter returns to the first page; the view resets "Launched by". */
export function updatePredictionsFilters(
  filters: PredictionsFilters,
  change: Partial<PredictionsFilters>
): PredictionsFilters {
  const next = { ...filters, ...change };
  if (!('page' in change)) {
    next.page = 0;
  }
  if (change.view && change.view !== 'all') {
    next.launchedBy = 'any';
  }
  return next;
}
