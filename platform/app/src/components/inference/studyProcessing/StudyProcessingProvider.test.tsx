import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  studyProcessingSnapshotFixture,
  studyProcessingSummaryFixtures,
  studyStatusUpdatedEventFixture,
} from './fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return null;
}

describe('StudyProcessingProvider', () => {
  beforeEach(() => {
    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider>
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });
  });

  afterEach(() => {
    act(() => {
      renderer.unmount();
    });
  });

  test('starts with idle snapshot and disconnected real-time state', () => {
    expect(contextValue.initialSnapshotStatus).toBe('idle');
    expect(contextValue.realtimeConnectionStatus).toBe('disconnected');
    expect(contextValue.isRealtimeDataStale).toBe(false);
  });

  test('exposes snapshot data through selector-backed read methods', () => {
    act(() => {
      contextValue.receiveSnapshot(studyProcessingSnapshotFixture.items);
    });

    expect(
      contextValue.getStudySummary(studyProcessingSummaryFixtures.processing.studyInstanceUID)
    ).toBe(studyProcessingSummaryFixtures.processing);
    expect(
      contextValue.getVisibleSummaries([
        studyProcessingSummaryFixtures.success.studyInstanceUID,
        '1.2.840.missing',
      ])
    ).toEqual([studyProcessingSummaryFixtures.success, undefined]);
  });

  test('routes snapshot and buffered update commands through the reducer', () => {
    act(() => {
      contextValue.startInitialSnapshot();
      contextValue.applyStatusUpdate(studyStatusUpdatedEventFixture);
      contextValue.receiveSnapshot(studyProcessingSnapshotFixture.items);
    });

    expect(contextValue.initialSnapshotStatus).toBe('ready');
    expect(contextValue.getStudySummary(studyStatusUpdatedEventFixture.studyInstanceUID)).toBe(
      studyStatusUpdatedEventFixture
    );
  });

  test('exposes connection recovery state without removing summaries', () => {
    act(() => {
      contextValue.receiveSnapshot(studyProcessingSnapshotFixture.items);
      contextValue.markConnectionReconnecting('Connection interrupted.');
    });

    expect(contextValue.realtimeConnectionStatus).toBe('reconnecting');
    expect(contextValue.realtimeConnectionError).toBe('Connection interrupted.');
    expect(contextValue.isRealtimeDataStale).toBe(true);
    expect(
      contextValue.getStudySummary(studyProcessingSummaryFixtures.success.studyInstanceUID)
    ).toBe(studyProcessingSummaryFixtures.success);
  });

  test('clears all processing state', () => {
    act(() => {
      contextValue.receiveSnapshot(studyProcessingSnapshotFixture.items);
      contextValue.markConnectionConnected();
      contextValue.clearStudyProcessingState();
    });

    expect(
      contextValue.getStudySummary(studyProcessingSummaryFixtures.success.studyInstanceUID)
    ).toBeUndefined();
    expect(contextValue.initialSnapshotStatus).toBe('idle');
    expect(contextValue.realtimeConnectionStatus).toBe('disconnected');
  });
});
