import {
  isTransientReportError,
  loadReportWithRetry,
  ReportLoadCancelledError,
  REPORT_RETRY_DELAYS_MS,
} from './reportRetry';
import { ViewerResultsRequestError } from './viewerResultsRepository';

const networkError = () => new ViewerResultsRequestError('x', null, null, null, true);
const httpError = (status: number, code: string | null = null) =>
  new ViewerResultsRequestError('x', status, code);

describe('isTransientReportError', () => {
  test.each([
    ['no response', networkError(), true],
    ['502', httpError(502), true],
    ['503', httpError(503), true],
    ['504', httpError(504), true],
    ['500 render failed', httpError(500, 'REPORT_RENDER_FAILED'), true],
    ['404 not available', httpError(404, 'REPORT_NOT_AVAILABLE'), false],
    ['422 render rejected', httpError(422, 'REPORT_RENDER_REJECTED'), false],
    ['503 coded not available', httpError(503, 'REPORT_NOT_AVAILABLE'), false],
    ['401', httpError(401), false],
    ['empty report (no status, had a response)', new ViewerResultsRequestError('x', null), false],
    ['plain Error', new Error('x'), false],
  ])('%s', (_name, error, expected) => {
    expect(isTransientReportError(error)).toBe(expected);
  });
});

describe('loadReportWithRetry', () => {
  const waits: number[] = [];
  const wait = (ms: number) => {
    waits.push(ms);
    return Promise.resolve();
  };
  beforeEach(() => {
    waits.length = 0;
  });

  test('waits 1 s, 2 s and 4 s between attempts', () => {
    expect(REPORT_RETRY_DELAYS_MS).toEqual([1000, 2000, 4000]);
  });

  test('returns the first success without waiting', async () => {
    const load = jest.fn().mockResolvedValue('ok');
    await expect(loadReportWithRetry(load, { wait, isCancelled: () => false })).resolves.toBe('ok');
    expect(load).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  test('retries network errors and 5xx until one succeeds', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValue('ok');
    await expect(loadReportWithRetry(load, { wait, isCancelled: () => false })).resolves.toBe('ok');
    expect(load).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1000, 2000]);
  });

  test('gives up after three retries and rethrows the last error', async () => {
    const last = httpError(502);
    const load = jest
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(last);
    await expect(loadReportWithRetry(load, { wait, isCancelled: () => false })).rejects.toBe(last);
    expect(load).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([1000, 2000, 4000]);
  });

  test('does not retry a permanent error', async () => {
    const error = httpError(404, 'REPORT_NOT_AVAILABLE');
    const load = jest.fn().mockRejectedValue(error);
    await expect(loadReportWithRetry(load, { wait, isCancelled: () => false })).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  test('stops once cancelled', async () => {
    let cancelled = false;
    const load = jest.fn().mockImplementation(() => {
      cancelled = true;
      return Promise.reject(networkError());
    });
    await expect(
      loadReportWithRetry(load, { wait, isCancelled: () => cancelled })
    ).rejects.toBeInstanceOf(ViewerResultsRequestError);
    expect(load).toHaveBeenCalledTimes(1);

    const never = jest.fn();
    await expect(
      loadReportWithRetry(never, { wait, isCancelled: () => true })
    ).rejects.toBeInstanceOf(ReportLoadCancelledError);
    expect(never).not.toHaveBeenCalled();
  });
});
