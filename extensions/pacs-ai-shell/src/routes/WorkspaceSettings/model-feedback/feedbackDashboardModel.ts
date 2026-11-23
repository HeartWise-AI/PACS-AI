import type {
  FeedbackReportCount,
  ModelFeedbackListItem,
} from '@pacs-ai/extension-core/src/api/inferenceDTO';
import {
  DEFAULT_REJECT_QUESTIONNAIRE_ID,
  DEFAULT_REJECT_REASON_IDS,
} from '@pacs-ai/extension-core/src/feedback/defaultRejectQuestionnaire';
import { feedbackUserLabel, modelLabel } from './modelFeedbackModel';

/** Approval below this share flags a model for review. */
export const REVIEW_THRESHOLD = 0.75;
/** Small-multiple panels shown; the table lists every rated model. */
export const MAX_MODEL_PANELS = 8;

export type FeedbackRange = '30d' | '90d' | '12m';

/** Days covered by each range; 90d and 12m are whole weeks. */
export const RANGES: Record<FeedbackRange, number> = { '30d': 30, '90d': 91, '12m': 364 };

export const UNSPECIFIED_REASON_ID = 'unspecified';

export interface RangeWindow {
  from: Date;
  // Exclusive: the start of tomorrow, local time.
  to: Date;
  priorFrom: Date;
  days: number;
  // Oldest first. Each bucket runs to the next start (or `to`); the oldest may be partial.
  bucketStarts: Date[];
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** The current and prior periods for a range, in 7-day buckets ending tonight. */
export function rangeWindow(range: FeedbackRange, now: Date): RangeWindow {
  const days = RANGES[range];
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const from = addLocalDays(to, -days);
  const priorFrom = addLocalDays(from, -days);
  const bucketCount = Math.ceil(days / 7);
  const bucketStarts: Date[] = [];
  for (let index = bucketCount; index >= 1; index--) {
    const start = addLocalDays(to, -7 * index);
    bucketStarts.push(start < from ? from : start);
  }
  return { from, to, priorFrom, days, bucketStarts };
}

export interface DashboardModelSource {
  modelId?: string | null;
  modelName?: string | null;
  version?: string | null;
  supportedDicomModalities?: string[] | null;
  outputMode?: string | null;
}

export interface FeedbackDashboardFilters {
  // '' means all.
  modality: string;
  outputMode: string;
  // A user id.
  reader: string;
}

export const ALL_FILTERS: FeedbackDashboardFilters = { modality: '', outputMode: '', reader: '' };

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

function modelMatches(model: DashboardModelSource | undefined, filters: FeedbackDashboardFilters) {
  if (!filters.modality && !filters.outputMode) {
    return true;
  }
  if (!model) {
    return false;
  }
  if (
    filters.modality &&
    !(model.supportedDicomModalities ?? []).some(
      modality => normalize(modality) === normalize(filters.modality)
    )
  ) {
    return false;
  }
  return !filters.outputMode || normalize(model.outputMode) === normalize(filters.outputMode);
}

function modelById(availableModels: DashboardModelSource[]) {
  const byId = new Map<string, DashboardModelSource>();
  (availableModels ?? []).forEach(model => {
    const id = model.modelId?.trim();
    if (id && !byId.has(id)) {
      byId.set(id, model);
    }
  });
  return byId;
}

/** Votes that match the filters. Votes for unknown models pass only with no model filter. */
export function filterVotes(
  items: ModelFeedbackListItem[],
  filters: FeedbackDashboardFilters,
  availableModels: DashboardModelSource[]
): ModelFeedbackListItem[] {
  const byId = modelById(availableModels);
  return (items ?? []).filter(item => {
    if (filters.reader && item.userId !== filters.reader) {
      return false;
    }
    return modelMatches(byId.get(item.inferenceModelId?.trim()), filters);
  });
}

/** Distinct values for the three filters, sorted. */
export function filterOptions(
  items: ModelFeedbackListItem[],
  availableModels: DashboardModelSource[]
) {
  const modalities = new Map<string, string>();
  const outputModes = new Map<string, string>();
  (availableModels ?? []).forEach(model => {
    (model.supportedDicomModalities ?? []).forEach(modality => {
      if (modality?.trim() && !modalities.has(normalize(modality))) {
        modalities.set(normalize(modality), modality.trim());
      }
    });
    if (model.outputMode?.trim() && !outputModes.has(normalize(model.outputMode))) {
      outputModes.set(normalize(model.outputMode), model.outputMode.trim());
    }
  });
  const readers = new Map<string, string>();
  (items ?? []).forEach(item => {
    if (item.userId && !readers.has(item.userId)) {
      readers.set(item.userId, feedbackUserLabel(item));
    }
  });
  const sorted = (values: string[]) => values.sort((left, right) => left.localeCompare(right));
  return {
    modalities: sorted(Array.from(modalities.values())),
    outputModes: sorted(Array.from(outputModes.values())),
    readers: Array.from(readers, ([id, label]) => ({ id, label })).sort((left, right) =>
      left.label.localeCompare(right.label)
    ),
  };
}

const isApprove = (item: ModelFeedbackListItem) => item.feedbackType?.toUpperCase() === 'APPROVE';
const isReject = (item: ModelFeedbackListItem) => item.feedbackType?.toUpperCase() === 'REJECT';

/** The default-questionnaire reason of a reject, else 'unspecified'. */
export function rejectReasonId(item: ModelFeedbackListItem): string {
  const answer = (item.answers ?? []).find(
    entry => entry?.questionnaireId === DEFAULT_REJECT_QUESTIONNAIRE_ID
  );
  const id = answer?.questionnaireAnswerIds?.find(answerId =>
    (DEFAULT_REJECT_REASON_IDS as readonly string[]).includes(answerId)
  );
  return id ?? UNSPECIFIED_REASON_ID;
}

const rate = (up: number, down: number) => (up + down > 0 ? up / (up + down) : null);
const deltaPts = (current: number | null, prior: number | null) =>
  current === null || prior === null ? null : (current - prior) * 100;

export interface DashboardWeek {
  start: Date;
  // Last day in the bucket (inclusive), for labels.
  end: Date;
  up: number;
  down: number;
  rate: number | null;
}

export interface DashboardModelRow {
  inferenceModelId: string;
  name: string;
  versions: string[];
  up: number;
  down: number;
  rate: number | null;
  deltaPts: number | null;
  weeklyRate: (number | null)[];
  topReasonId: string | null;
  // Unix seconds.
  lastRatedAt: number;
  belowThreshold: boolean;
}

export interface FeedbackDashboard {
  kpis: {
    approvalRate: number | null;
    approvalDeltaPts: number | null;
    total: number;
    up: number;
    down: number;
    totalDeltaPct: number | null;
    modelsRated: number;
    modelsDeployed: number;
    modelsUnrated: number;
    reportsRated: number;
    reportsReturned: number | null;
    reportsRatedPct: number | null;
    reportsDeltaPts: number | null;
  };
  weeks: DashboardWeek[];
  reasons: { id: string; count: number }[];
  models: DashboardModelRow[];
  // Shared percent domain for the per-model panels.
  scale: { min: number; max: number };
}

export interface ReportCountsInput {
  current: FeedbackReportCount[] | null;
  prior: FeedbackReportCount[] | null;
}

/** Completed reports matching the model filters; null when counts are unknown. */
export function sumReportCounts(
  counts: FeedbackReportCount[] | null,
  filters: FeedbackDashboardFilters,
  availableModels: DashboardModelSource[]
): number | null {
  if (!counts) {
    return null;
  }
  const byName = new Map<string, DashboardModelSource>();
  (availableModels ?? []).forEach(model => {
    const name = normalize(model.modelName);
    if (name && !byName.has(name)) {
      byName.set(name, model);
    }
  });
  return counts.reduce((sum, entry) => {
    if (filters.modality && normalize(entry.modality) !== normalize(filters.modality)) {
      return sum;
    }
    if (filters.outputMode) {
      const model = byName.get(normalize(entry.modelName));
      if (!model || normalize(model.outputMode) !== normalize(filters.outputMode)) {
        return sum;
      }
    }
    return sum + Math.max(0, entry.completedCount || 0);
  }, 0);
}

const reportKey = (item: ModelFeedbackListItem) =>
  item.executionId || item.runId || `vote:${item.id}`;

function distinctReports(items: ModelFeedbackListItem[]) {
  return new Set(items.map(reportKey)).size;
}

function topReason(rejects: ModelFeedbackListItem[]): string | null {
  const counts = new Map<string, number>();
  rejects.forEach(item => {
    const id = rejectReasonId(item);
    if (id !== UNSPECIFIED_REASON_ID) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  });
  let best: string | null = null;
  let bestCount = 0;
  // Ties go to the earlier reason in questionnaire order.
  DEFAULT_REJECT_REASON_IDS.forEach(id => {
    const count = counts.get(id) ?? 0;
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  });
  return best;
}

const floor10 = (value: number) => Math.floor(value / 10) * 10;

export function buildDashboard({
  items,
  availableModels,
  filters,
  window,
  reportCounts,
  threshold = REVIEW_THRESHOLD,
}: {
  items: ModelFeedbackListItem[];
  availableModels: DashboardModelSource[];
  filters: FeedbackDashboardFilters;
  window: RangeWindow;
  reportCounts: ReportCountsInput;
  threshold?: number;
}): FeedbackDashboard {
  const filtered = filterVotes(items, filters, availableModels);
  const fromS = window.from.getTime() / 1000;
  const toS = window.to.getTime() / 1000;
  const priorS = window.priorFrom.getTime() / 1000;
  const current = filtered.filter(item => item.updatedAt >= fromS && item.updatedAt < toS);
  const prior = filtered.filter(item => item.updatedAt >= priorS && item.updatedAt < fromS);

  const bounds = window.bucketStarts.map((start, index) => ({
    start,
    endExclusive: window.bucketStarts[index + 1] ?? window.to,
  }));
  const bucketOf = (item: ModelFeedbackListItem) => {
    const time = item.updatedAt * 1000;
    return bounds.findIndex(
      bucket => time >= bucket.start.getTime() && time < bucket.endExclusive.getTime()
    );
  };

  const up = current.filter(isApprove).length;
  const down = current.filter(isReject).length;
  const priorUp = prior.filter(isApprove).length;
  const priorDown = prior.filter(isReject).length;
  const approvalRate = rate(up, down);
  const priorRate = rate(priorUp, priorDown);
  const total = up + down;
  const priorTotal = priorUp + priorDown;

  // Weeks, all models combined.
  const weeks: DashboardWeek[] = bounds.map(bucket => ({
    start: bucket.start,
    end: addLocalDays(bucket.endExclusive, -1),
    up: 0,
    down: 0,
    rate: null,
  }));
  current.forEach(item => {
    const index = bucketOf(item);
    if (index >= 0) {
      if (isApprove(item)) {
        weeks[index].up += 1;
      } else if (isReject(item)) {
        weeks[index].down += 1;
      }
    }
  });
  weeks.forEach(week => {
    week.rate = rate(week.up, week.down);
  });

  // Reasons: the six fixed ids, then unspecified when present.
  const rejects = current.filter(isReject);
  const reasonCounts = new Map<string, number>();
  rejects.forEach(item => {
    const id = rejectReasonId(item);
    reasonCounts.set(id, (reasonCounts.get(id) ?? 0) + 1);
  });
  const reasons = DEFAULT_REJECT_REASON_IDS.map(id => ({ id, count: reasonCounts.get(id) ?? 0 }));
  const unspecified = reasonCounts.get(UNSPECIFIED_REASON_ID) ?? 0;
  const reasonRows: { id: string; count: number }[] = [...reasons];
  if (unspecified > 0) {
    reasonRows.push({ id: UNSPECIFIED_REASON_ID, count: unspecified });
  }

  // Per model.
  const groups = new Map<string, ModelFeedbackListItem[]>();
  current.forEach(item => {
    const id = item.inferenceModelId?.trim() || item.modelId;
    groups.set(id, [...(groups.get(id) ?? []), item]);
  });
  const priorByModel = new Map<string, { up: number; down: number }>();
  prior.forEach(item => {
    const id = item.inferenceModelId?.trim() || item.modelId;
    const entry = priorByModel.get(id) ?? { up: 0, down: 0 };
    if (isApprove(item)) {
      entry.up += 1;
    } else if (isReject(item)) {
      entry.down += 1;
    }
    priorByModel.set(id, entry);
  });
  const models: DashboardModelRow[] = Array.from(groups, ([inferenceModelId, votes]) => {
    const modelUp = votes.filter(isApprove).length;
    const modelDown = votes.filter(isReject).length;
    const modelRate = rate(modelUp, modelDown);
    const priorEntry = priorByModel.get(inferenceModelId);
    const weekly = bounds.map(() => ({ up: 0, down: 0 }));
    votes.forEach(item => {
      const index = bucketOf(item);
      if (index >= 0) {
        if (isApprove(item)) {
          weekly[index].up += 1;
        } else if (isReject(item)) {
          weekly[index].down += 1;
        }
      }
    });
    return {
      inferenceModelId,
      name: modelLabel(inferenceModelId, availableModels),
      versions: Array.from(new Set(votes.map(item => item.modelVersion).filter(Boolean))).sort(),
      up: modelUp,
      down: modelDown,
      rate: modelRate,
      deltaPts: deltaPts(modelRate, priorEntry ? rate(priorEntry.up, priorEntry.down) : null),
      weeklyRate: weekly.map(week => rate(week.up, week.down)),
      topReasonId: topReason(votes.filter(isReject)),
      lastRatedAt: Math.max(...votes.map(item => item.updatedAt || 0)),
      belowThreshold: modelRate !== null && modelRate < threshold,
    };
  }).sort(
    (left, right) =>
      right.up + right.down - (left.up + left.down) || left.name.localeCompare(right.name)
  );

  // Deployed models under the model filters.
  const deployed = Array.from(modelById(availableModels).entries()).filter(([, model]) =>
    modelMatches(model, filters)
  );
  const modelsUnrated = deployed.filter(([id]) => !groups.has(id)).length;

  const reportsRated = distinctReports(current);
  const reportsReturned = sumReportCounts(reportCounts.current, filters, availableModels);
  const priorReturned = sumReportCounts(reportCounts.prior, filters, availableModels);
  const reportsRatedPct = reportsReturned ? reportsRated / reportsReturned : null;
  const priorRatedPct =
    priorReturned && prior.length ? distinctReports(prior) / priorReturned : null;

  const lowest = Math.min(
    ...[...weeks.map(week => week.rate), ...models.flatMap(model => model.weeklyRate)]
      .filter((value): value is number => value !== null)
      .map(value => value * 100),
    100
  );

  return {
    kpis: {
      approvalRate,
      approvalDeltaPts: deltaPts(approvalRate, priorRate),
      total,
      up,
      down,
      totalDeltaPct: priorTotal > 0 ? ((total - priorTotal) / priorTotal) * 100 : null,
      modelsRated: groups.size,
      modelsDeployed: deployed.length,
      modelsUnrated,
      reportsRated,
      reportsReturned,
      reportsRatedPct,
      reportsDeltaPts: deltaPts(reportsRatedPct, priorRatedPct),
    },
    weeks,
    reasons: reasonRows,
    models,
    scale: { min: Math.min(50, floor10(lowest)), max: 100 },
  };
}
