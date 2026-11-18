// Chat answers cite stored model results ("[1]"); this resolves a citation to
// the result the viewer holds, for the chat's "Open result" and "Raw result".
import type { ViewerModelResult } from './types';

// The fields of a chat `model_result` citation used here (chat backend
// contract, "Citations"); structural, so this module does not depend on the
// chat component.
export interface ModelResultCitation {
  modelName: string;
  studyInstanceUID?: string | null;
  studyServiceJobId?: string | null;
  completedAt?: string | null;
}

export interface CitationResultActions {
  open: (() => void) | null;
  loadRawResult?: (() => Promise<unknown>) | null;
  loading?: boolean;
}

const text = (value: string | null | undefined): string => value?.trim() ?? '';

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

interface ParsedTimestamp {
  // "YYYY-MM-DDTHH:MM:SS" as written, without its zone.
  wallClock: string;
  // Milliseconds since the epoch, when the timestamp carries a zone.
  instant: number | null;
}

function parseTimestamp(value: string): ParsedTimestamp | null {
  const match = TIMESTAMP.exec(value);
  if (!match) {
    return null;
  }
  const wallClock = `${match[1]}T${match[2]}:${match[3] ?? '00'}`;
  const instant = match[4] ? Date.parse(`${wallClock}${match[4].toUpperCase()}`) : NaN;
  return { wallClock, instant: Number.isNaN(instant) ? null : instant };
}

/**
 * True when two completion times are the same second. The chat backend and the
 * viewer both get the time from study-service but not always in the same
 * notation: with or without a zone, "T" or a space, fractions of a second.
 */
export function isSameCompletionTime(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = text(left);
  const b = text(right);
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const first = parseTimestamp(a);
  const second = parseTimestamp(b);
  if (!first || !second) {
    return false;
  }
  if (first.instant !== null && second.instant !== null) {
    return first.instant === second.instant;
  }
  if (first.instant === null && second.instant === null) {
    return first.wallClock === second.wallClock;
  }
  // One of them has no zone: it is the other's local or UTC wall clock.
  const [zoned, naive] = first.instant !== null ? [first, second] : [second, first];
  return (
    naive.wallClock === zoned.wallClock ||
    naive.wallClock === new Date(zoned.instant as number).toISOString().slice(0, 19)
  );
}

/**
 * The stored result a citation refers to, among the results the viewer holds:
 * the one with the same study, model name and study-service job; failing
 * that, the one with the same model name and completion time. A result of
 * another study never matches.
 */
export function findResultForCitation(
  citation: ModelResultCitation,
  results: readonly ViewerModelResult[]
): ViewerModelResult | null {
  const modelName = text(citation.modelName);
  const studyInstanceUID = text(citation.studyInstanceUID);
  const jobId = text(citation.studyServiceJobId);
  if (!modelName) {
    return null;
  }
  const ofModel = results.filter(
    result =>
      text(result.modelName) === modelName &&
      (!studyInstanceUID || text(result.studyInstanceUID) === studyInstanceUID)
  );

  const byJob =
    studyInstanceUID && jobId
      ? ofModel.find(result => text(result.studyServiceJobId) === jobId)
      : undefined;
  if (byJob) {
    return byJob;
  }
  return (
    ofModel.find(result => isSameCompletionTime(result.completedAt, citation.completedAt)) ?? null
  );
}

export interface CitationResultHostOptions {
  // False when the user may not view stored results.
  canViewResults: boolean;
  results: readonly ViewerModelResult[];
  // True while the results are not loaded yet.
  resultsLoading?: boolean;
  openResult: (result: ViewerModelResult) => void;
  // Loads the stored result data of a run's model execution.
  loadExecutionResult?: (request: { runId: string; executionId: string }) => Promise<unknown>;
}

/**
 * What the chat can do with a cited model result: open it in the result
 * drawer when the viewer holds it, and load its raw data when the result has
 * a model execution (the only stored data the viewer can read).
 */
export function resolveCitationResultActions(
  citation: ModelResultCitation,
  {
    canViewResults,
    results,
    resultsLoading,
    openResult,
    loadExecutionResult,
  }: CitationResultHostOptions
): CitationResultActions {
  if (!canViewResults) {
    return { open: null, loadRawResult: null };
  }
  const result = findResultForCitation(citation, results);
  if (!result) {
    return { open: null, loadRawResult: null, loading: !!resultsLoading };
  }
  const { runId, executionId } = result;
  return {
    open: () => openResult(result),
    loadRawResult:
      loadExecutionResult && runId && executionId
        ? () => loadExecutionResult({ runId, executionId })
        : null,
  };
}
