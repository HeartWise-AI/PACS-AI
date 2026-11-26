import { isInferenceSeriesEligible } from '@pacs-ai/ui/src/components/SelectSeriesModal/isInferenceSeriesEligible';
import type {
  PendingRunEnd,
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
 * A model's completed runs for the study, newest first: the runs the backend
 * lists with the result, or the result alone when it lists none.
 */
export function listResultRuns(result: ViewerModelResult | null): ViewerModelResult[] {
  if (!result) {
    return [];
  }
  if (!result.runs?.length) {
    return [result];
  }
  return [...result.runs].sort((left, right) => completedTime(right) - completedTime(left));
}

/** True when both results are the same run of the same study and model. */
export function isSameResultRun(left: ViewerModelResult, right: ViewerModelResult): boolean {
  if (left.studyInstanceUID !== right.studyInstanceUID || left.modelName !== right.modelName) {
    return false;
  }
  if (left.executionId && right.executionId) {
    return left.executionId === right.executionId;
  }
  if (left.studyServiceJobId && right.studyServiceJobId) {
    return left.studyServiceJobId === right.studyServiceJobId;
  }
  return viewerResultKey(left) === viewerResultKey(right);
}

/**
 * The reported result whose run list holds `result`, so the other runs of the
 * same model can be offered next to it; null when no loaded result does.
 */
export function findResultGroup(
  result: ViewerModelResult,
  results: ViewerModelResult[]
): ViewerModelResult | null {
  const sameModel = results.filter(
    item =>
      item.studyInstanceUID === result.studyInstanceUID &&
      item.modelName === result.modelName &&
      (!item.modality || !result.modality || item.modality === result.modality)
  );
  return (
    sameModel.find(item => listResultRuns(item).some(run => isSameResultRun(run, result))) ??
    sameModel[0] ??
    null
  );
}

/**
 * The stored result of one run, searched by execution id and then run id in
 * the reported results and in the runs listed with them. Null when the
 * backend does not (yet) list that run.
 */
export function findRunResult(
  results: ViewerModelResult[],
  ids: { executionId?: string | null; runId?: string | null; modelName?: string | null }
): ViewerModelResult | null {
  const all = results.flatMap(result => (result.runs?.length ? result.runs : [result]));
  if (ids.executionId) {
    const byExecution = all.find(result => result.executionId === ids.executionId);
    if (byExecution) {
      return byExecution;
    }
  }
  if (ids.runId) {
    return (
      all.find(
        result =>
          result.runId === ids.runId && (!ids.modelName || result.modelName === ids.modelName)
      ) ?? null
    );
  }
  return null;
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

/**
 * The stored result of a pending run among the loaded results. The reported
 * result of a model is its best run, which is often not the run the user has
 * just requested (an earlier run may have used more videos), so every listed
 * run is searched, not only the reported one.
 */
export function findResultForPendingRun(
  pending: PendingViewerModelRun,
  results: ViewerModelResult[]
): ViewerModelResult | null {
  const studyResults = results.filter(
    result => result.studyInstanceUID === pending.studyInstanceUID
  );
  const byId = findRunResult(studyResults, {
    executionId: pending.executionId,
    runId: pending.runId,
    modelName: pending.modelName,
  });
  if (byId) {
    return byId;
  }

  const reported = findLatestResultForModel(
    {
      modelId: pending.modelId,
      containerId: pending.containerId,
      modelName: pending.modelName,
      version: pending.modelVersion,
    },
    studyResults
  );
  return listResultRuns(reported).find(run => isResultForPendingRun(run, pending)) ?? null;
}

/** The newest completion time among a model's runs, for a pending run's baseline. */
export function newestCompletedAt(result: ViewerModelResult | null): string | null {
  return listResultRuns(result)[0]?.completedAt ?? null;
}

const FAILED_RUN_OUTCOMES = ['FAILED', 'NO_RESULT'];
const SUCCESSFUL_RUN_OUTCOMES = ['SUCCESS', 'SUCCESS_WITH_SKIPS', 'PARTIAL_SUCCESS'];

function reasonText(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) {
    return null;
  }
  // Backend error messages can carry a whole response body.
  return text.length > 240 ? `${text.slice(0, 239)}…` : text;
}

/**
 * How the pending run ended according to its run detail, or null while it is
 * still running. The run's own execution decides when it can be identified;
 * otherwise the outcome of the terminal run does. A completed run is reported
 * as such from here: the caller must not wait for the latest results to show
 * it, because they keep reporting the model's best run.
 */
export function findPendingRunEnd(
  status: ViewerModelRunStatus,
  pending: PendingViewerModelRun
): PendingRunEnd | null {
  const execution = pending.executionId
    ? status.executions.find(item => item.executionId === pending.executionId)
    : status.executions.length === 1
      ? status.executions[0]
      : undefined;

  switch (execution?.status?.toLowerCase()) {
    case 'completed':
      return { kind: 'completed', completedAt: execution.completedAt ?? null };
    case 'skipped':
      return {
        kind: 'skipped',
        reason: reasonText(execution.skipReasonMessage) ?? reasonText(execution.skipReasonCode),
      };
    case 'failed':
      return { kind: 'failed', reason: reasonText(execution.errorMessage) };
    case 'cancelled':
      return { kind: 'cancelled', reason: null };
    default:
      break;
  }

  if (status.phase?.toUpperCase() !== 'TERMINAL') {
    return null;
  }
  const outcome = status.outcome?.toUpperCase() ?? '';
  if (outcome === 'CANCELLED') {
    return { kind: 'cancelled', reason: null };
  }
  if (FAILED_RUN_OUTCOMES.includes(outcome)) {
    return { kind: 'failed', reason: null };
  }
  // A finished run whose execution is not listed: its result, if any, is
  // looked up by run id.
  return SUCCESSFUL_RUN_OUTCOMES.includes(outcome)
    ? { kind: 'completed', completedAt: null }
    : null;
}

/**
 * Why the pending run will never produce a result, or null while it may
 * still do so (or has produced one).
 */
export function findPendingRunFailure(
  status: ViewerModelRunStatus,
  pending: PendingViewerModelRun
): PendingRunFailure | null {
  const end = findPendingRunEnd(status, pending);
  return end && end.kind !== 'completed' ? end.kind : null;
}

/**
 * A result for a run that has completed but that the backend does not list
 * (an api-pacs or study-service that predates the run list). It carries what
 * is needed to open the run's report; `reported` is the model's reported
 * result, used for what the run request does not return.
 */
export function resultFromPendingRun(
  pending: PendingViewerModelRun,
  completedAt: string | null,
  reported: ViewerModelResult | null
): ViewerModelResult | null {
  if (!pending.runId || !pending.executionId) {
    return null;
  }
  return {
    studyInstanceUID: pending.studyInstanceUID,
    modelName: pending.modelName,
    modelVersion: pending.modelVersion,
    modality: reported?.modality ?? null,
    modelId: reported?.modelId ?? null,
    // /model/proxy/available returns the model-info id as modelId.
    artifactModelId: reported?.artifactModelId ?? pending.modelId,
    containerId: pending.containerId ?? reported?.containerId ?? null,
    runId: pending.runId,
    executionId: pending.executionId,
    studyServiceJobId: null,
    completedAt: completedAt ?? new Date().toISOString(),
    trigger: 'VIEWER_REQUEST',
    selectedViews: null,
    // Without a reported result the drawer falls back to the stored result
    // when the report cannot be rendered.
    reportAvailable: reported?.reportAvailable ?? true,
    ...(pending.seriesInstanceUIDs !== undefined
      ? { dispatchSeriesInstanceUIDs: pending.seriesInstanceUIDs }
      : {}),
    provisional: true,
  };
}

export type ResultRunTrigger = 'auto' | 'viewer' | 'manual' | 'imported' | 'legacy';

export interface ResultRunDescription {
  // Epoch milliseconds of the run's completion; null when unknown.
  completedTime: number | null;
  trigger: ResultRunTrigger;
  // Series the run was dispatched with: a count, 'all', or null when unknown.
  series: number | 'all' | null;
  eligibleVideoCount: number | null;
  inputVideoCount: number | null;
  // The model version, only when the listed runs do not all share one.
  version: string | null;
  // The run reported by default.
  best: boolean;
}

const RUN_TRIGGERS: Record<string, ResultRunTrigger> = {
  AUTO: 'auto',
  VIEWER_REQUEST: 'viewer',
  MANUAL_REPROCESS: 'manual',
  LEGACY_IMPORT: 'imported',
};

/**
 * What tells one run of a model from another in the run switcher. `runs` are
 * the runs it is listed with; a single run is the default one.
 */
export function describeResultRun(
  run: ViewerModelResult,
  runs: ViewerModelResult[]
): ResultRunDescription {
  const time = completedTime(run);
  const versions = new Set(runs.map(item => item.modelVersion ?? ''));
  const series = run.dispatchSeriesInstanceUIDs;
  return {
    completedTime: time || null,
    // A null trigger means study-service ran the model without an api-pacs run.
    trigger: run.trigger ? (RUN_TRIGGERS[run.trigger] ?? 'legacy') : 'legacy',
    series: series === undefined ? null : series === null || !series.length ? 'all' : series.length,
    eligibleVideoCount: run.eligibleVideoCount ?? null,
    inputVideoCount: run.inputVideoCount ?? null,
    version: versions.size > 1 ? run.modelVersion : null,
    // Without a flag, the run reported by latest-results is the default one;
    // a provisional run is one the backend has not listed yet.
    best: run.bestRun ?? !run.provisional,
  };
}

/** Date and time of a run in the browser's locale and time zone. */
export function formatRunDateTime(time: number | string | null | undefined): string {
  const value = typeof time === 'string' ? Date.parse(time) : time;
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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

interface FeedbackQuestionnaireFields {
  approveFeedbackQuestionnaires?: unknown[] | null;
  rejectFeedbackQuestionnaires?: unknown[] | null;
}

export type FeedbackModel<T> = Partial<T> & {
  modelId: string;
  version: string;
  approveFeedbackQuestionnaires: unknown[];
  rejectFeedbackQuestionnaires: unknown[];
};

/**
 * The model descriptor the feedback thumbs use for a stored result. Feedback
 * records are keyed by the model-info id and version ("{modelId}-{version}"),
 * so the id comes from the result's artifactModelId (not its Firestore
 * registration id) and falls back to the matching available model; the
 * questionnaires come from that available model. The match is the inverse of
 * findLatestResultForModel: by container id, then model-info id, then model
 * name and version, then model name. Returns null when no model-info id is
 * known, so no thumbs are shown.
 */
export function resolveFeedbackModel<
  T extends ViewerResultModelIdentity & FeedbackQuestionnaireFields,
>(result: ViewerModelResult, availableModels: T[]): FeedbackModel<T> | null {
  const models = availableModels ?? [];
  const byName = models.filter(model => sameText(model.modelName, result.modelName));
  const match =
    models.find(model => sameText(model.containerId, result.containerId)) ??
    models.find(model => sameText(model.modelId, result.artifactModelId)) ??
    byName.find(model => sameText(model.version, result.modelVersion)) ??
    byName[0];

  const modelId = result.artifactModelId?.trim() || match?.modelId?.trim() || '';
  if (!modelId) {
    return null;
  }

  return {
    ...match,
    modelId,
    version: result.modelVersion?.trim() || match?.version?.trim() || '',
    approveFeedbackQuestionnaires: match?.approveFeedbackQuestionnaires ?? [],
    rejectFeedbackQuestionnaires: match?.rejectFeedbackQuestionnaires ?? [],
  } as FeedbackModel<T>;
}
