import { isInferenceSeriesEligible } from '@pacs-ai/ui/src/components/SelectSeriesModal/isInferenceSeriesEligible';
import type {
  PendingRunFailure,
  PendingViewerModelRun,
  ResultSeriesInfo,
  ResultSeriesScope,
  SelectedView,
  SelectedViewBadge,
  ViewerModelResult,
  ViewerModelRunStatus,
  ViewerResultModelIdentity,
} from './types';

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = left?.trim();
  return !!normalizedLeft && normalizedLeft === right?.trim();
}

function completedTime(result: ViewerModelResult): number {
  const time = result.completedAt ? Date.parse(result.completedAt) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function newest(results: ViewerModelResult[]): ViewerModelResult | null {
  return results.reduce<ViewerModelResult | null>(
    (latest, result) =>
      !latest || completedTime(result) > completedTime(latest) ? result : latest,
    null
  );
}

/**
 * Finds the latest stored result for an available model: by container id,
 * then by the model's id against the result's model-info or registration id,
 * then by model name and version, then by model name alone.
 */
export function findLatestResultForModel(
  model: ViewerResultModelIdentity,
  results: ViewerModelResult[]
): ViewerModelResult | null {
  const byContainer = results.filter(result => sameText(model.containerId, result.containerId));
  if (byContainer.length) {
    return newest(byContainer);
  }

  const byId = results.filter(
    result =>
      sameText(model.modelId, result.artifactModelId) || sameText(model.modelId, result.modelId)
  );
  if (byId.length) {
    return newest(byId);
  }

  const byName = results.filter(result => sameText(model.modelName, result.modelName));
  const byNameAndVersion = byName.filter(result => sameText(model.version, result.modelVersion));
  return newest(byNameAndVersion.length ? byNameAndVersion : byName);
}

export function viewerModelKey(model: ViewerResultModelIdentity): string {
  return (
    model.containerId?.trim() ||
    model.modelId?.trim() ||
    `${model.modelName}@${model.version ?? ''}`
  );
}

export function viewerResultKey(result: ViewerModelResult): string {
  return JSON.stringify([
    result.studyInstanceUID,
    result.modelName,
    result.runId,
    result.executionId,
    result.studyServiceJobId,
    result.completedAt,
  ]);
}

/**
 * True when `result` is the outcome of the pending run: it carries the run or
 * execution id returned by the run request, or (when the backend omits them)
 * it completed after the result that was current when the run was requested
 * (also used when the run was already active and its ids are unknown).
 */
export function isResultForPendingRun(
  result: ViewerModelResult,
  pending: PendingViewerModelRun
): boolean {
  if (
    (pending.executionId && result.executionId === pending.executionId) ||
    (pending.runId && result.runId === pending.runId)
  ) {
    return true;
  }

  if (result.runId && pending.runId) {
    return false;
  }

  const completed = completedTime(result);
  const baseline = pending.baselineCompletedAt ? Date.parse(pending.baselineCompletedAt) : NaN;
  return (
    completed > 0 &&
    (Number.isNaN(baseline) ? completed >= pending.requestedAt : completed > baseline)
  );
}

const FAILED_RUN_OUTCOMES = ['FAILED', 'CANCELLED', 'NO_RESULT'];

/**
 * Why the pending run will never produce a result, or null while it may
 * still do so. The run's own execution decides when it can be identified;
 * otherwise only a terminal run without a result counts.
 */
export function findPendingRunFailure(
  status: ViewerModelRunStatus,
  pending: PendingViewerModelRun
): PendingRunFailure | null {
  const execution = pending.executionId
    ? status.executions.find(item => item.executionId === pending.executionId)
    : status.executions.length === 1
      ? status.executions[0]
      : undefined;

  switch (execution?.status?.toLowerCase()) {
    case 'skipped':
      return 'skipped';
    case 'failed':
    case 'cancelled':
      return 'failed';
    case 'completed':
      // The stored result follows shortly.
      return null;
    default:
      break;
  }

  return status.phase?.toUpperCase() === 'TERMINAL' &&
    FAILED_RUN_OUTCOMES.includes(status.outcome?.toUpperCase() ?? '')
    ? 'failed'
    : null;
}

interface SelectedViewDisplaySet {
  displaySetInstanceUID: string;
  SeriesInstanceUID?: string;
  instances?: Array<{ SOPInstanceUID?: string } | undefined>;
  instance?: { SOPInstanceUID?: string };
}

function firstSOPInstanceUID(displaySet: SelectedViewDisplaySet): string | undefined {
  return displaySet.instances?.[0]?.SOPInstanceUID ?? displaySet.instance?.SOPInstanceUID;
}

/**
 * Display sets that show a selected view. Each multiframe instance is its own
 * display set, so the SOP Instance UID of its first instance identifies the
 * clip; the series UID is only used when no display set matches the SOP UID.
 */
export function findDisplaySetsForSelectedView(
  view: SelectedView,
  displaySets: SelectedViewDisplaySet[]
): SelectedViewDisplaySet[] {
  if (view.sopInstanceUID) {
    const bySOP = displaySets.filter(
      displaySet => firstSOPInstanceUID(displaySet) === view.sopInstanceUID
    );
    if (bySOP.length) {
      return bySOP;
    }
  }

  if (view.seriesInstanceUID) {
    return displaySets.filter(
      displaySet => displaySet.SeriesInstanceUID === view.seriesInstanceUID
    );
  }

  return [];
}

export function buildSelectedViewBadges(
  selectedViews: SelectedView[] | null,
  displaySets: SelectedViewDisplaySet[]
): Record<string, SelectedViewBadge> {
  const badges: Record<string, SelectedViewBadge> = {};
  (selectedViews ?? []).forEach((view, index) => {
    findDisplaySetsForSelectedView(view, displaySets).forEach(displaySet => {
      if (!badges[displaySet.displaySetInstanceUID]) {
        badges[displaySet.displaySetInstanceUID] = {
          number: index + 1,
          viewLabel: view.viewLabel,
        };
      }
    });
  });
  return badges;
}

interface SeriesScopeDisplaySet {
  StudyInstanceUID?: string;
  SeriesInstanceUID?: string;
  Modality?: string;
  modality?: string;
  SeriesNumber?: number | string | null;
  SeriesDescription?: string | null;
  description?: string | null;
  excludeFromThumbnailBrowser?: boolean;
}

interface LoadedSeries {
  modality: string;
  eligible: boolean;
  seriesNumber: string | null;
  description: string | null;
}

function textOrNull(value: unknown): string | null {
  if (typeof value === 'number') {
    return String(value);
  }
  return (typeof value === 'string' && value.trim()) || null;
}

/**
 * Which series a stored result covers. The backend records the dispatched
 * series for every run requested from the viewer, picked or not, so a subset
 * is recognized by comparing that list with the study's series loaded in the
 * viewer: the series of the same DICOM modalities as the used ones that the
 * series pop-up would offer. Returns null when the backend does not report
 * the dispatched series.
 */
export function resolveResultSeriesScope(
  result: Pick<ViewerModelResult, 'studyInstanceUID' | 'dispatchSeriesInstanceUIDs'>,
  displaySets: SeriesScopeDisplaySet[]
): ResultSeriesScope | null {
  const used = result.dispatchSeriesInstanceUIDs;
  if (used === undefined) {
    return null;
  }
  if (used === null || used.length === 0) {
    return { kind: 'all', series: [] };
  }

  // One entry per series: a series can have several display sets.
  const loaded = new Map<string, LoadedSeries>();
  displaySets.forEach(displaySet => {
    const uid = displaySet?.SeriesInstanceUID;
    if (!uid || displaySet.StudyInstanceUID !== result.studyInstanceUID) {
      return;
    }
    const current = loaded.get(uid);
    loaded.set(uid, {
      modality:
        current?.modality || (displaySet.Modality || displaySet.modality || '').toUpperCase(),
      eligible:
        !!current?.eligible ||
        (!displaySet.excludeFromThumbnailBrowser && isInferenceSeriesEligible(displaySet)),
      seriesNumber: current?.seriesNumber ?? textOrNull(displaySet.SeriesNumber),
      description:
        current?.description ??
        textOrNull(displaySet.SeriesDescription) ??
        textOrNull(displaySet.description),
    });
  });

  const usedSet = new Set(used);
  const series: ResultSeriesInfo[] = [];
  const modalities = new Set<string>();
  used.forEach(uid => {
    const entry = loaded.get(uid);
    if (!entry) {
      return;
    }
    series.push({
      seriesInstanceUID: uid,
      seriesNumber: entry.seriesNumber,
      description: entry.description,
    });
    if (entry.modality) {
      modalities.add(entry.modality);
    }
  });
  if (!modalities.size) {
    return { kind: 'count', used: used.length, series };
  }

  let unused = 0;
  loaded.forEach((entry, uid) => {
    if (!usedSet.has(uid) && entry.eligible && modalities.has(entry.modality)) {
      unused += 1;
    }
  });
  return unused
    ? { kind: 'subset', used: used.length, total: used.length + unused, series }
    : { kind: 'all', series };
}
