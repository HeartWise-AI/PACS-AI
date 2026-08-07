import type { StudyProcessingSSEConnection } from './sseConnection';
import {
  calculateStudyProcessingSSEReconnectDelay,
  createStudyProcessingSSEReconnectController,
  shouldRetryStudyProcessingSSE,
} from './sseReconnect';
import { StudyProcessingSSEError } from './sseTransport';

function createConnection(
  overrides: Partial<StudyProcessingSSEConnection> = {}
): StudyProcessingSSEConnection {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    reconnect: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    isActive: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('study processing SSE reconnect policy', () => {
  test('retries network failures and HTTP 503 only', () => {
    expect(shouldRetryStudyProcessingSSE(new TypeError('network failed'))).toBe(true);
    expect(
      shouldRetryStudyProcessingSSE(new StudyProcessingSSEError('Temporarily unavailable.', 503))
    ).toBe(true);
    expect(shouldRetryStudyProcessingSSE(new StudyProcessingSSEError('Unauthorized.', 401))).toBe(
      false
    );
    expect(shouldRetryStudyProcessingSSE(new StudyProcessingSSEError('Forbidden.', 403))).toBe(
      false
    );
    expect(shouldRetryStudyProcessingSSE(new StudyProcessingSSEError('Server error.', 500))).toBe(
      false
    );
  });

  test('uses exponential delays and never exceeds the configured cap', () => {
    const policy = {
      initialDelayMs: 1000,
      maxDelayMs: 8000,
      multiplier: 2,
      jitterRatio: 0.2,
    };

    expect(calculateStudyProcessingSSEReconnectDelay(1, policy, () => 0.5)).toBe(1000);
    expect(calculateStudyProcessingSSEReconnectDelay(2, policy, () => 0.5)).toBe(2000);
    expect(calculateStudyProcessingSSEReconnectDelay(3, policy, () => 0.5)).toBe(4000);
    expect(calculateStudyProcessingSSEReconnectDelay(4, policy, () => 1)).toBe(8000);
    expect(calculateStudyProcessingSSEReconnectDelay(20, policy, () => 1)).toBe(8000);
  });

  test('adds bounded jitter around a retry delay', () => {
    const policy = { initialDelayMs: 1000, maxDelayMs: 5000, jitterRatio: 0.2 };

    expect(calculateStudyProcessingSSEReconnectDelay(1, policy, () => 0)).toBe(800);
    expect(calculateStudyProcessingSSEReconnectDelay(1, policy, () => 1)).toBe(1200);
  });

  test('reconnects after a network failure', async () => {
    let stopController = () => {};
    const connection = createConnection({
      start: jest.fn().mockRejectedValue(new TypeError('network failed')),
      reconnect: jest.fn().mockImplementation(async () => stopController()),
    });
    const sleep = jest.fn().mockResolvedValue(undefined);
    const controller = createStudyProcessingSSEReconnectController({
      connection,
      sleep,
      random: () => 0.5,
    });
    stopController = controller.stop;

    await controller.start();

    expect(connection.start).toHaveBeenCalledTimes(1);
    expect(connection.reconnect).toHaveBeenCalledWith(
      'Live processing connection was interrupted.'
    );
    expect(sleep).toHaveBeenCalledWith(1000, expect.any(AbortSignal));
    expect(controller.isRunning()).toBe(false);
  });

  test('increases the delay across repeated retryable failures', async () => {
    let stopController = () => {};
    const reconnect = jest
      .fn()
      .mockRejectedValueOnce(
        new StudyProcessingSSEError('The service is temporarily unavailable.', 503)
      )
      .mockImplementationOnce(async () => stopController());
    const connection = createConnection({
      start: jest.fn().mockRejectedValue(new TypeError('network failed')),
      reconnect,
    });
    const delays: number[] = [];
    const controller = createStudyProcessingSSEReconnectController({
      connection,
      sleep: jest.fn(async delayMs => {
        delays.push(delayMs);
      }),
      random: () => 0.5,
      backoff: { initialDelayMs: 1000, maxDelayMs: 8000, jitterRatio: 0 },
    });
    stopController = controller.stop;

    await controller.start();

    expect(delays).toEqual([1000, 2000]);
    expect(reconnect).toHaveBeenCalledTimes(2);
  });

  test.each([401, 403, 500])('does not reconnect after HTTP %i', async status => {
    const error = new StudyProcessingSSEError('Non-retryable connection error.', status);
    const connection = createConnection({
      start: jest.fn().mockRejectedValue(error),
    });
    const sleep = jest.fn();
    const controller = createStudyProcessingSSEReconnectController({ connection, sleep });

    await expect(controller.start()).rejects.toBe(error);

    expect(connection.reconnect).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
    expect(controller.isRunning()).toBe(false);
  });
});
