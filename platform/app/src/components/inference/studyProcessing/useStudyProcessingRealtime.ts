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
import { studyProcessingSSETelemetry, type StudyProcessingSSETelemetry } from './sseTelemetry';

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
  authenticatedIdentity: string | null;
  refreshVisibleStudySnapshot(): Promise<void> | void;
  connectionFactory?: StudyProcessingSSEConnectionFactory;
  reconnectControllerFactory?: StudyProcessingSSEReconnectControllerFactory;
  recoveryFactory?: StudyProcessingSSERecoveryFactory;
  telemetry?: StudyProcessingSSETelemetry;
}

const RECOVERY_ERROR = 'Unable to refresh visible processing status after reconnecting.';

export function useStudyProcessingRealtime({
  enabled,
  authenticatedIdentity,
  refreshVisibleStudySnapshot,
  connectionFactory = createStudyProcessingSSEConnection,
  reconnectControllerFactory = createStudyProcessingSSEReconnectController,
  recoveryFactory = createStudyProcessingSSERecovery,
  telemetry = studyProcessingSSETelemetry,
}: UseStudyProcessingRealtimeOptions): void {
  const {
    applyStatusUpdate,
    markConnectionConnecting,
    markConnectionConnected,
    markConnectionReconnecting,
    markConnectionDegraded,
    markConnectionDisconnected,
  } = useStudyProcessing();
  const { recordConnectionError, recordConnectionState, recordInvalidEvent, recordRetryScheduled } =
    telemetry;

  const handleConnectionState = useCallback(
    (status: RealtimeConnectionStatus, error: string | null) => {
      recordConnectionState(status);
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
      recordConnectionState,
    ]
  );

  const connection = useMemo(
    () =>
      connectionFactory({
        onEvent: applyStatusUpdate,
        onInvalidEvent: recordInvalidEvent,
        onStateChange: handleConnectionState,
      }),
    [applyStatusUpdate, connectionFactory, handleConnectionState, recordInvalidEvent]
  );

  const reconnectController = useMemo(
    () =>
      reconnectControllerFactory({
        connection,
        onRetryScheduled: recordRetryScheduled,
      }),
    [connection, reconnectControllerFactory, recordRetryScheduled]
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
    if (!enabled || !authenticatedIdentity) {
      recovery.stop();
      reconnectController.stop();
      return;
    }

    recovery.start();
    void reconnectController.start().catch(error => {
      // Non-retryable failures are already reflected through onStateChange.
      recordConnectionError(error);
    });

    return () => {
      recovery.stop();
      reconnectController.stop();
    };
  }, [authenticatedIdentity, enabled, reconnectController, recordConnectionError, recovery]);
}
