import { studyProcessingRunHistoryFixture, studyProcessingSummaryFixtures } from './fixtures';
import {
  createRunHistorySynchronizationCoordinator,
  getRunHistorySynchronizationTarget,
} from './runHistorySynchronization';
import type { RunHistoryTransportResponse } from './runHistoryTransport';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('run-history synchronization', () => {
  test('requests a refresh only when the summary run version is newer than cached REST data', () => {
    const cachedRun = studyProcessingRunHistoryFixture.runs[0];
    const summary = {
      ...studyProcessingSummaryFixtures.processing,
      studyInstanceUID: studyProcessingRunHistoryFixture.studyInstanceUID,
      runId: cachedRun.id,
      version: cachedRun.version + 1,
    };

    expect(getRunHistorySynchronizationTarget(summary, studyProcessingRunHistoryFixture)).toEqual({
      runId: cachedRun.id,
      version: cachedRun.version + 1,
    });
    expect(
      getRunHistorySynchronizationTarget(
        { ...summary, version: cachedRun.version },
        studyProcessingRunHistoryFixture
      )
    ).toBeNull();
    expect(
      getRunHistorySynchronizationTarget(
        { ...summary, version: cachedRun.version - 1 },
        studyProcessingRunHistoryFixture
      )
    ).toBeNull();
  });

  test('requests a refresh when SSE references a run absent from loaded history', () => {
    const summary = {
      ...studyProcessingSummaryFixtures.processing,
      studyInstanceUID: studyProcessingRunHistoryFixture.studyInstanceUID,
      runId: 'new-run-from-sse',
      version: 1,
    };

    expect(getRunHistorySynchronizationTarget(summary, studyProcessingRunHistoryFixture)).toEqual({
      runId: 'new-run-from-sse',
      version: 1,
    });
  });

  test('preserves lazy loading when no REST history has been cached', () => {
    expect(
      getRunHistorySynchronizationTarget(studyProcessingSummaryFixtures.processing, null)
    ).toBeNull();
  });

  test('coalesces rapid newer targets into one trailing refresh', async () => {
    const firstRefresh = deferred<RunHistoryTransportResponse>();
    const refresh = jest
      .fn<Promise<void>, []>()
      .mockImplementationOnce(() => firstRefresh.promise.then(() => undefined))
      .mockResolvedValueOnce(undefined);
    const coordinator = createRunHistorySynchronizationCoordinator();

    const request = coordinator.request({ runId: 'run-1', version: 2 }, refresh);
    coordinator.request({ runId: 'run-1', version: 3 }, refresh);
    coordinator.request({ runId: 'run-1', version: 4 }, refresh);

    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    firstRefresh.resolve({ history: studyProcessingRunHistoryFixture, partial: false });
    await request;

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test('does not request equal or stale targets after an attempted refresh', async () => {
    const refresh = jest.fn(async () => undefined);
    const coordinator = createRunHistorySynchronizationCoordinator();

    await coordinator.request({ runId: 'run-1', version: 4 }, refresh);
    await coordinator.request({ runId: 'run-1', version: 4 }, refresh);
    await coordinator.request({ runId: 'run-1', version: 3 }, refresh);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('allows the same target after an auth-generation reset', async () => {
    const firstRefresh = deferred<void>();
    const refresh = jest
      .fn<Promise<void>, []>()
      .mockImplementationOnce(() => firstRefresh.promise)
      .mockResolvedValueOnce(undefined);
    const coordinator = createRunHistorySynchronizationCoordinator();

    const priorAuthRequest = coordinator.request({ runId: 'shared-run', version: 2 }, refresh);
    coordinator.reset();
    await coordinator.request({ runId: 'shared-run', version: 2 }, refresh);
    firstRefresh.resolve();
    await priorAuthRequest;

    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
