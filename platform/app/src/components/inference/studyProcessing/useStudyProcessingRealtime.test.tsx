import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingSummaryFixtures } from './fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import type {
  CreateStudyProcessingSSEConnectionOptions,
  StudyProcessingSSEConnection,
} from './sseConnection';
import type {
  CreateStudyProcessingSSEReconnectControllerOptions,
  StudyProcessingSSEReconnectController,
} from './sseReconnect';
import type {
  CreateStudyProcessingSSERecoveryOptions,
  StudyProcessingSSERecovery,
} from './sseRecovery';
import {
  useStudyProcessingRealtime,
  type UseStudyProcessingRealtimeOptions,
} from './useStudyProcessingRealtime';

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer | null = null;

function Harness(options: UseStudyProcessingRealtimeOptions) {
  useStudyProcessingRealtime(options);
  contextValue = useStudyProcessing();
  return null;
}

function createRealtimeDoubles() {
  let connectionOptions!: CreateStudyProcessingSSEConnectionOptions;
  let reconnectOptions!: CreateStudyProcessingSSEReconnectControllerOptions;
  let recoveryOptions!: CreateStudyProcessingSSERecoveryOptions;
  const connection: StudyProcessingSSEConnection = {
    start: jest.fn().mockResolvedValue(undefined),
    reconnect: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    isActive: jest.fn().mockReturnValue(false),
    subscribe: jest.fn().mockReturnValue(jest.fn()),
  };
  const reconnectController: StudyProcessingSSEReconnectController = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    isRunning: jest.fn().mockReturnValue(false),
  };
  const recovery: StudyProcessingSSERecovery = {
    start: jest.fn(),
    stop: jest.fn(),
    waitForIdle: jest.fn().mockResolvedValue(undefined),
  };
  const connectionFactory = jest.fn((options: CreateStudyProcessingSSEConnectionOptions) => {
    connectionOptions = options;
    return connection;
  });
  const reconnectControllerFactory = jest.fn(
    (options: CreateStudyProcessingSSEReconnectControllerOptions) => {
      reconnectOptions = options;
      return reconnectController;
    }
  );
  const recoveryFactory = jest.fn((options: CreateStudyProcessingSSERecoveryOptions) => {
    recoveryOptions = options;
    return recovery;
  });

  return {
    connection,
    connectionFactory,
    connectionOptions: () => connectionOptions,
    reconnectController,
    reconnectControllerFactory,
    reconnectOptions: () => reconnectOptions,
    recovery,
    recoveryFactory,
    recoveryOptions: () => recoveryOptions,
  };
}

function renderHarness(options: UseStudyProcessingRealtimeOptions) {
  renderer = TestRenderer.create(
    <StudyProcessingProvider>
      <Harness {...options} />
    </StudyProcessingProvider>
  );
}

describe('useStudyProcessingRealtime', () => {
  afterEach(() => {
    if (renderer) {
      act(() => renderer?.unmount());
      renderer = null;
    }
  });

  test('starts one reconnecting stream and recovery observer, then stops both on unmount', () => {
    const doubles = createRealtimeDoubles();

    act(() => {
      renderHarness({
        enabled: true,
        refreshVisibleStudySnapshot: jest.fn(),
        connectionFactory: doubles.connectionFactory,
        reconnectControllerFactory: doubles.reconnectControllerFactory,
        recoveryFactory: doubles.recoveryFactory,
      });
    });

    expect(doubles.connectionFactory).toHaveBeenCalledTimes(1);
    expect(doubles.reconnectControllerFactory).toHaveBeenCalledTimes(1);
    expect(doubles.reconnectOptions().connection).toBe(doubles.connection);
    expect(doubles.recovery.start).toHaveBeenCalledTimes(1);
    expect(doubles.reconnectController.start).toHaveBeenCalledTimes(1);

    act(() => renderer?.unmount());
    renderer = null;

    expect(doubles.recovery.stop).toHaveBeenCalledTimes(1);
    expect(doubles.reconnectController.stop).toHaveBeenCalledTimes(1);
  });

  test('routes live summaries and connection states into the canonical provider store', () => {
    const doubles = createRealtimeDoubles();

    act(() => {
      renderHarness({
        enabled: true,
        refreshVisibleStudySnapshot: jest.fn(),
        connectionFactory: doubles.connectionFactory,
        reconnectControllerFactory: doubles.reconnectControllerFactory,
        recoveryFactory: doubles.recoveryFactory,
      });
    });

    act(() => {
      doubles.connectionOptions().onEvent(studyProcessingSummaryFixtures.processing);
      doubles.connectionOptions().onStateChange?.('reconnecting', 'Connection interrupted.');
    });

    expect(
      contextValue.getStudySummary(studyProcessingSummaryFixtures.processing.studyInstanceUID)
    ).toBe(studyProcessingSummaryFixtures.processing);
    expect(contextValue.realtimeConnectionStatus).toBe('reconnecting');
    expect(contextValue.realtimeConnectionError).toBe('Connection interrupted.');
    expect(contextValue.isRealtimeDataStale).toBe(true);

    act(() => {
      doubles.connectionOptions().onStateChange?.('connected', null);
    });

    expect(contextValue.realtimeConnectionStatus).toBe('connected');
    expect(contextValue.realtimeConnectionError).toBeNull();
    expect(contextValue.isRealtimeDataStale).toBe(false);
  });

  test('gives reconnect recovery the visible-study snapshot callback', () => {
    const doubles = createRealtimeDoubles();
    const refreshVisibleStudySnapshot = jest.fn();

    act(() => {
      renderHarness({
        enabled: true,
        refreshVisibleStudySnapshot,
        connectionFactory: doubles.connectionFactory,
        reconnectControllerFactory: doubles.reconnectControllerFactory,
        recoveryFactory: doubles.recoveryFactory,
      });
    });

    doubles.recoveryOptions().refreshVisibleStudySnapshot();
    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(1);

    act(() => {
      doubles.recoveryOptions().onRecoveryError?.('Snapshot recovery failed.');
    });
    expect(contextValue.realtimeConnectionStatus).toBe('degraded');
    expect(contextValue.realtimeConnectionError).toBe('Snapshot recovery failed.');
  });

  test('does not open protected realtime transport when disabled', () => {
    const doubles = createRealtimeDoubles();

    act(() => {
      renderHarness({
        enabled: false,
        refreshVisibleStudySnapshot: jest.fn(),
        connectionFactory: doubles.connectionFactory,
        reconnectControllerFactory: doubles.reconnectControllerFactory,
        recoveryFactory: doubles.recoveryFactory,
      });
    });

    expect(doubles.recovery.start).not.toHaveBeenCalled();
    expect(doubles.reconnectController.start).not.toHaveBeenCalled();
    expect(doubles.recovery.stop).toHaveBeenCalledTimes(1);
    expect(doubles.reconnectController.stop).toHaveBeenCalledTimes(1);
  });
});
