import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import type { StudyProcessingSnapshotTransport } from './snapshotTransport';
import { studyProcessingSummaryFixtures } from './fixtures';
import { useVisibleStudyProcessingSnapshot } from './useVisibleStudyProcessingSnapshot';

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;
let retryVisibleSnapshot: () => void;

interface HarnessProps {
  enabled: boolean;
  fixtureMode?: boolean;
  studyInstanceUIDs: string[];
  transport: StudyProcessingSnapshotTransport;
}

function Harness({ enabled, fixtureMode = false, studyInstanceUIDs, transport }: HarnessProps) {
  retryVisibleSnapshot = useVisibleStudyProcessingSnapshot({
    enabled,
    fixtureMode,
    studyInstanceUIDs,
    transport,
  });
  contextValue = useStudyProcessing();
  return null;
}

function providerWithHarness(props: HarnessProps) {
  return React.createElement(StudyProcessingProvider, null, React.createElement(Harness, props));
}

function renderHarness(props: HarnessProps) {
  renderer = TestRenderer.create(providerWithHarness(props));
}

describe('useVisibleStudyProcessingSnapshot', () => {
  afterEach(() => {
    if (renderer) {
      act(() => renderer.unmount());
    }
  });

  test('loads visible summaries into the provider store', async () => {
    const loadVisibleStudySnapshot = jest
      .fn()
      .mockResolvedValue([studyProcessingSummaryFixtures.processing]);
    const transport = { loadVisibleStudySnapshot };

    await act(async () => {
      renderHarness({
        enabled: true,
        studyInstanceUIDs: ['1.2.840.processing'],
        transport,
      });
      await Promise.resolve();
    });

    expect(loadVisibleStudySnapshot).toHaveBeenCalledWith(['1.2.840.processing']);
    expect(contextValue.initialSnapshotStatus).toBe('ready');
    expect(
      contextValue.getStudySummary(studyProcessingSummaryFixtures.processing.studyInstanceUID)
    ).toBe(studyProcessingSummaryFixtures.processing);
  });

  test('reports a safe transport failure through the provider store', async () => {
    const transport = {
      loadVisibleStudySnapshot: jest.fn().mockRejectedValue(new Error('Service unavailable.')),
    };

    await act(async () => {
      renderHarness({ enabled: true, studyInstanceUIDs: ['1.2.3'], transport });
      await Promise.resolve();
    });

    expect(contextValue.initialSnapshotStatus).toBe('error');
    expect(contextValue.initialSnapshotError).toBe('Service unavailable.');
  });

  test('retries the same visible studies after a snapshot failure', async () => {
    const loadVisibleStudySnapshot = jest
      .fn()
      .mockRejectedValueOnce(new Error('Service unavailable.'))
      .mockResolvedValueOnce([]);
    const transport = { loadVisibleStudySnapshot };

    await act(async () => {
      renderHarness({ enabled: true, studyInstanceUIDs: ['1.2.3'], transport });
      await Promise.resolve();
    });
    expect(contextValue.initialSnapshotStatus).toBe('error');

    await act(async () => {
      retryVisibleSnapshot();
      await Promise.resolve();
    });

    expect(loadVisibleStudySnapshot).toHaveBeenCalledTimes(2);
    expect(loadVisibleStudySnapshot).toHaveBeenLastCalledWith(['1.2.3']);
    expect(contextValue.initialSnapshotStatus).toBe('ready');
  });

  test('does not request protected processing data when access is disabled', async () => {
    const loadVisibleStudySnapshot = jest.fn();

    await act(async () => {
      renderHarness({
        enabled: false,
        studyInstanceUIDs: ['1.2.3'],
        transport: { loadVisibleStudySnapshot },
      });
      await Promise.resolve();
    });

    expect(loadVisibleStudySnapshot).not.toHaveBeenCalled();
    expect(contextValue.initialSnapshotStatus).toBe('idle');
  });

  test('marks fixture mode connected without claiming REST is realtime-connected', async () => {
    const liveTransport = { loadVisibleStudySnapshot: jest.fn().mockResolvedValue([]) };

    await act(async () => {
      renderHarness({ enabled: true, studyInstanceUIDs: [], transport: liveTransport });
      await Promise.resolve();
    });

    expect(contextValue.realtimeConnectionStatus).toBe('disconnected');

    const fixtureTransport = { loadVisibleStudySnapshot: jest.fn().mockResolvedValue([]) };
    await act(async () => {
      renderer.update(
        providerWithHarness({
          enabled: true,
          fixtureMode: true,
          studyInstanceUIDs: [],
          transport: fixtureTransport,
        })
      );
      await Promise.resolve();
    });

    expect(contextValue.realtimeConnectionStatus).toBe('connected');
  });
});
