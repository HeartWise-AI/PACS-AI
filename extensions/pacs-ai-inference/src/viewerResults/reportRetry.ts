import { ViewerResultsRequestError, VIEWER_RESULTS_ERROR_CODES } from './viewerResultsRepository';

// Waits before each retry of the model report request: 1 s, 2 s, then 4 s.
// On a large study the request can fail without a response while the image
// downloads saturate the connection, or a gateway can answer 502/503 while
// api-pacs or the model container restarts. Both usually clear within seconds.
export const REPORT_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000];

// Errors that do not change on retry: the backend said the model has no report
// or refused to render it.
const PERMANENT_REPORT_ERROR_CODES = new Set<string>([
  VIEWER_RESULTS_ERROR_CODES.reportNotAvailable,
  VIEWER_RESULTS_ERROR_CODES.reportRenderRejected,
]);

// A report request worth retrying: no HTTP response at all, or a 5xx.
export function isTransientReportError(error: unknown): boolean {
  if (!(error instanceof ViewerResultsRequestError)) {
    return false;
  }
  if (error.errorCode && PERMANENT_REPORT_ERROR_CODES.has(error.errorCode)) {
    return false;
  }
  if (error.noResponse) {
    return true;
  }
  return typeof error.status === 'number' && error.status >= 500 && error.status <= 599;
}

export class ReportLoadCancelledError extends Error {
  constructor() {
    super('The report request was cancelled.');
    this.name = 'ReportLoadCancelledError';
  }
}

export interface LoadReportWithRetryOptions {
  // Resolves after the given delay. The caller owns the timer so it can clear
  // it when the drawer closes.
  wait: (ms: number) => Promise<void>;
  // True once the caller no longer wants the result; no further request is made.
  isCancelled: () => boolean;
  delaysMs?: readonly number[];
  isRetryable?: (error: unknown) => boolean;
}

// Calls `load`, and after a transient failure waits and calls it again, once
// per entry of `delaysMs`. The last error is rethrown when every attempt fails.
export async function loadReportWithRetry<T>(
  load: () => Promise<T>,
  {
    wait,
    isCancelled,
    delaysMs = REPORT_RETRY_DELAYS_MS,
    isRetryable = isTransientReportError,
  }: LoadReportWithRetryOptions
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (isCancelled()) {
      throw new ReportLoadCancelledError();
    }
    try {
      return await load();
    } catch (error) {
      if (attempt >= delaysMs.length || !isRetryable(error) || isCancelled()) {
        throw error;
      }
    }
    await wait(delaysMs[attempt]);
  }
}
