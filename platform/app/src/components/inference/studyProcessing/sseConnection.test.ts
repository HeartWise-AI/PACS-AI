import { createStudyProcessingSSEConnection } from './sseConnection';

function deferredStream() {
  let resolve: () => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<void>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve: () => resolve(),
    reject: (error: unknown) => reject(error),
  };
}

describe('study processing SSE connection lifecycle', () => {
  it('starts one stream and exposes its AbortSignal', async () => {
    const stream = deferredStream();
    const streamEvents = jest.fn().mockReturnValue(stream.promise);
    const connection = createStudyProcessingSSEConnection({
      streamEvents,
      onEvent: jest.fn(),
    });

    const firstStart = connection.start();
    const secondStart = connection.start();

    expect(firstStart).toBe(secondStart);
    expect(streamEvents).toHaveBeenCalledTimes(1);
    expect(streamEvents.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
    expect(streamEvents.mock.calls[0][0].signal.aborted).toBe(false);
    expect(connection.isActive()).toBe(true);

    stream.resolve();
    await firstStart;
    expect(connection.isActive()).toBe(false);
  });

  it('aborts an active stream and treats intentional shutdown as success', async () => {
    const streamEvents = jest.fn(({ signal }: { signal: AbortSignal }) => {
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('request aborted')));
      });
    });
    const connection = createStudyProcessingSSEConnection({
      streamEvents,
      onEvent: jest.fn(),
    });

    const running = connection.start();
    const signal = streamEvents.mock.calls[0][0].signal;
    connection.stop();

    await expect(running).resolves.toBeUndefined();
    expect(signal.aborted).toBe(true);
    expect(connection.isActive()).toBe(false);
  });

  it('allows a new stream to start after the previous stream is stopped', async () => {
    const signals: AbortSignal[] = [];
    const streamEvents = jest.fn(({ signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('request aborted')));
      });
    });
    const connection = createStudyProcessingSSEConnection({
      streamEvents,
      onEvent: jest.fn(),
    });

    const firstRun = connection.start();
    connection.stop();
    await firstRun;

    const secondRun = connection.start();

    expect(streamEvents).toHaveBeenCalledTimes(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    connection.stop();
    await secondRun;
  });

  it('does not hide a genuine connection failure', async () => {
    const failure = new Error('network unavailable');
    const connection = createStudyProcessingSSEConnection({
      streamEvents: jest.fn().mockRejectedValue(failure),
      onEvent: jest.fn(),
    });

    await expect(connection.start()).rejects.toBe(failure);
    expect(connection.isActive()).toBe(false);
  });

  it('can be stopped safely when no stream is active', () => {
    const connection = createStudyProcessingSSEConnection({
      streamEvents: jest.fn(),
      onEvent: jest.fn(),
    });

    expect(() => connection.stop()).not.toThrow();
    expect(connection.isActive()).toBe(false);
  });
});
