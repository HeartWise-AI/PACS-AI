import type {
  PendingViewerModelRun,
  SelectedView,
  SelectedViewBadge,
  ViewerModelResult,
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
 * Finds the latest stored result for an available model: by registered model
 * id first, then by model name and version, then by model name alone.
 */
export function findLatestResultForModel(
  model: ViewerResultModelIdentity,
  results: ViewerModelResult[]
): ViewerModelResult | null {
  const byId = results.filter(result => sameText(model.modelId, result.modelId));
  if (byId.length) {
    return newest(byId);
  }

  const byName = results.filter(result => sameText(model.modelName, result.modelName));
  const byNameAndVersion = byName.filter(result => sameText(model.version, result.modelVersion));
  return newest(byNameAndVersion.length ? byNameAndVersion : byName);
}

export function viewerModelKey(model: ViewerResultModelIdentity): string {
  return model.modelId?.trim() || `${model.modelName}@${model.version ?? ''}`;
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
 * it completed after the result that was current when the run was requested.
 */
export function isResultForPendingRun(
  result: ViewerModelResult,
  pending: PendingViewerModelRun
): boolean {
  if (
    (pending.executionId && result.executionId === pending.executionId) ||
    result.runId === pending.runId
  ) {
    return true;
  }

  if (result.runId) {
    return false;
  }

  const completed = completedTime(result);
  const baseline = pending.baselineCompletedAt ? Date.parse(pending.baselineCompletedAt) : NaN;
  return (
    completed > 0 &&
    (Number.isNaN(baseline) ? completed >= pending.requestedAt : completed > baseline)
  );
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
