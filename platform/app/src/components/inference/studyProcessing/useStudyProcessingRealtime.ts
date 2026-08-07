import { useCallback, useEffect, useMemo } from 'react';
import { useStudyProcessing } from './StudyProcessingProvider';
import {
  createStudyProcessingSSEConnection,
  type CreateStudyProcessingSSEConnectionOptions,
  type StudyProcessingSSEConnection,
} from './sseConnection';
import {
  createStudyProcessingSSEReconnectController,
  type CreateStudyProcessingSSEReconnectControllerOptions,
  type StudyProcessingSSEReconnectController,
} from './sseReconnect';
import {
  createStudyProcessingSSERecovery,
  type CreateStudyProcessingSSERecoveryOptions,
  type StudyProcessingSSERecovery,
} from './sseRecovery';
import type { RealtimeConnectionStatus } from './reducer';

type StudyProcessingSSEConnectionFactory = (
  options: CreateStudyProcessingSSEConnectionOptions
) => StudyProcessingSSEConnection;

type StudyProcessingSSEReconnectControllerFactory = (
  options: CreateStudyProcessingSSEReconnectControllerOptions
) => StudyProcessingSSEReconnectController;

type StudyProcessingSSERecoveryFactory = (
  options: CreateStudyProcessingSSERecoveryOptions
) => StudyProcessingSSERecovery;

export interface UseStudyProcessingRealtimeOptions {
  enabled: boolean;
  refreshVisibleStudySnapshot(): Promise<void> | void;
  connectionFactory?: StudyProcessingSSEConnectionFactory;
  reconnectControllerFactory?: StudyProcessingSSEReconnectControllerFactory;
  recoveryFactory?: StudyProcessingSSERecoveryFactory;
}

const RECOVERY_ERROR = 'Unable to refresh visible processing status after reconnecting.';

export function useStudyProcessingRealtime({
  enabled,
  refreshVisibleStudySnapshot,
  connectionFactory = createStudyProcessingSSEConnection,
  reconnectControllerFactory = createStudyProcessingSSEReconnectController,
  recoveryFactory = createStudyProcessingSSERecovery,
}: UseStudyProcessingRealtimeOptions): void {
  const {
    applyStatusUpdate,
    markConnectionConnecting,
    markConnectionConnected,
    markConnectionReconnecting,
    markConnectionDegraded,
    markConnectionDisconnected,
  } = useStudyProcessing();

  const handleConnectionState = useCallback(
    (status: RealtimeConnectionStatus, error: string | null) => {
      switch (status) {
        case 'connecting':
          markConnectionConnecting();
          break;
        case 'connected':
          markConnectionConnected();
          break;
        case 'reconnecting':
          markConnectionReconnecting(error);
          break;
        case 'degraded':
          markConnectionDegraded(error ?? 'Live processing connection was interrupted.');
          break;
        case 'disconnected':
          markConnectionDisconnected();
          break;
      }
    },
    [
      markConnectionConnected,
      markConnectionConnecting,
      markConnectionDegraded,
      markConnectionDisconnected,
      markConnectionReconnecting,
    ]
  );

  const connection = useMemo(
    () =>
      connectionFactory({
        onEvent: applyStatusUpdate,
        onStateChange: handleConnectionState,
      }),
    [applyStatusUpdate, connectionFactory, handleConnectionState]
  );

  const reconnectController = useMemo(
    () => reconnectControllerFactory({ connection }),
    [connection, reconnectControllerFactory]
  );

  const recovery = useMemo(
    () =>
      recoveryFactory({
        connection,
        refreshVisibleStudySnapshot,
        onRecoveryError: error => markConnectionDegraded(error || RECOVERY_ERROR),
      }),
    [connection, markConnectionDegraded, recoveryFactory, refreshVisibleStudySnapshot]
  );

  useEffect(() => {
    if (!enabled) {
      recovery.stop();
      reconnectController.stop();
      return;
    }

    recovery.start();
    void reconnectController.start().catch(() => {
      // Non-retryable failures are already reflected through onStateChange.
    });

    return () => {
      recovery.stop();
      reconnectController.stop();
    };
  }, [enabled, reconnectController, recovery]);
}
