import type {
  StudyProcessingSSEConnection,
  StudyProcessingSSEConnectionStateListener,
} from './sseConnection';
import { createStudyProcessingSSERecovery } from './sseRecovery';
import { StudyProcessingRESTError } from './restRepository';
import type { RealtimeConnectionStatus } from './reducer';

function createObservableConnection(): {
  connection: StudyProcessingSSEConnection;
  emit(status: RealtimeConnectionStatus, error?: string | null): void;
  listenerCount(): number;
} {
  const listeners = new Set<StudyProcessingSSEConnectionStateListener>();
  return {
    connection: {
      start: jest.fn().mockResolvedValue(undefined),
      reconnect: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      isActive: jest.fn().mockReturnValue(false),
      subscribe: jest.fn(listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    },
    emit: (status, error = null) => {
      listeners.forEach(listener => listener(status, error));
    },
    listenerCount: () => listeners.size,
  };
}

describe('study processing SSE REST recovery', () => {
  test('does not refresh after the initial connection opens', async () => {
    const observable = createObservableConnection();
    const refreshVisibleStudySnapshot = jest.fn().mockResolvedValue(undefined);
    const recovery = createStudyProcessingSSERecovery({
      connection: observable.connection,
      refreshVisibleStudySnapshot,
    });
    recovery.start();

    observable.emit('connecting');
    observable.emit('connected');
    await recovery.waitForIdle();

    expect(refreshVisibleStudySnapshot).not.toHaveBeenCalled();
  });

  test('refreshes the visible REST snapshot after a successful reconnect', async () => {
    const observable = createObservableConnection();
    const refreshVisibleStudySnapshot = jest.fn().mockResolvedValue(undefined);
    const recovery = createStudyProcessingSSERecovery({
      connection: observable.connection,
      refreshVisibleStudySnapshot,
    });
    recovery.start();

    observable.emit('reconnecting', 'Connection interrupted.');
    observable.emit('connected');
    await recovery.waitForIdle();

    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(1);
  });

  test('deduplicates repeated reconnecting states before one successful connection', async () => {
    const observable = createObservableConnection();
    const refreshVisibleStudySnapshot = jest.fn().mockResolvedValue(undefined);
    const recovery = createStudyProcessingSSERecovery({
      connection: observable.connection,
      refreshVisibleStudySnapshot,
    });
    recovery.start();

    observable.emit('reconnecting');
    observable.emit('degraded', 'Still unavailable.');
    observable.emit('reconnecting');
    observable.emit('connected');
    observable.emit('connected');
    await recovery.waitForIdle();

    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(1);
  });

  test('refreshes once for each completed reconnect cycle', async () => {
    const observable = createObservableConnection();
    const refreshVisibleStudySnapshot = jest.fn().mockResolvedValue(undefined);
    const recovery = createStudyProcessingSSERecovery({
      connection: observable.connection,
      refreshVisibleStudySnapshot,
    });
    recovery.start();

    observable.emit('reconnecting');
    observable.emit('connected');
    observable.emit('reconnecting');
    observable.emit('connected');
    await recovery.waitForIdle();

    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(2);
  });

  test('reports a safe recovery error and remains available for a later refresh', async () => {
    const observable = createObservableConnection();
    const refreshVisibleStudySnapshot = jest
      .fn()
      .mockRejectedValueOnce(new Error('sensitive response'))
      .mockResolvedValueOnce(undefined);
    const onRecoveryError = jest.fn();
    const recovery = createStudyProcessingSSERecovery({
      connection: observable.connection,
      refreshVisibleStudySnapshot,
      onRecoveryError,
    });
    recovery.start();

    observable.emit('reconnecting');
    observable.emit('connected');
    await recovery.waitForIdle();
    observable.emit('reconnecting');
    observable.emit('connected');
    await recovery.waitForIdle();

    expect(onRecoveryError).toHaveBeenCalledWith(
      'Unable to refresh visible processing status after reconnecting.'
    );
    expect(onRecoveryError).not.toHaveBeenCalledWith('sensitive response');
    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(2);
  });

  test('preserves an already-sanitized REST error message', async () => {
    const observable = createObservableConnection();
    const onRecoveryError = jest.fn();
    const recovery = createStudyProcessingSSERecovery({
      connection: observable.connection,
      refreshVisibleStudySnapshot: jest
        .fn()
        .mockRejectedValue(
          new StudyProcessingRESTError('Processing status is temporarily unavailable.', 503)
        ),
      onRecoveryError,
    });
    recovery.start();

    observable.emit('reconnecting');
    observable.emit('connected');
    await recovery.waitForIdle();

    expect(onRecoveryError).toHaveBeenCalledWith('Processing status is temporarily unavailable.');
  });

  test('stops observing connection changes when disabled', async () => {
    const observable = createObservableConnection();
    const refreshVisibleStudySnapshot = jest.fn().mockResolvedValue(undefined);
    const recovery = createStudyProcessingSSERecovery({
      connection: observable.connection,
      refreshVisibleStudySnapshot,
    });
    recovery.start();
    expect(observable.listenerCount()).toBe(1);

    recovery.stop();
    observable.emit('reconnecting');
    observable.emit('connected');
    await recovery.waitForIdle();

    expect(observable.listenerCount()).toBe(0);
    expect(refreshVisibleStudySnapshot).not.toHaveBeenCalled();
  });
});
