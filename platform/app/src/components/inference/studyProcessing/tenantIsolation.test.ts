import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { getStudyProcessingAuthIdentity, shouldClearStudyProcessingState } from './authIdentity';
import { studyProcessingRunHistoryFixture, studyProcessingSummaryFixtures } from './fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import type { RunHistoryTransportResponse } from './runHistoryTransport';

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('study processing tenant isolation lifecycle', () => {
  afterEach(() => {
    act(() => renderer.unmount());
  });

  test('clears every study cache and ignores a late history response before reusing a UID', async () => {
    const tenantAIdentity = getStudyProcessingAuthIdentity({
      id: 'shared-user',
      tenantId: 'tenant-a',
    });
    const tenantBIdentity = getStudyProcessingAuthIdentity({
      id: 'shared-user',
      tenantId: 'tenant-b',
    });
    const tenantAHistory = deferred<RunHistoryTransportResponse>();
    const sameStudyUID = studyProcessingSummaryFixtures.processing.studyInstanceUID;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(StudyProcessingProvider, null, React.createElement(ContextConsumer))
      );
    });
    act(() => {
      contextValue.receiveSnapshot([studyProcessingSummaryFixtures.processing]);
    });

    let historyRequest!: Promise<void>;
    act(() => {
      historyRequest = contextValue.ensureRunHistory(sameStudyUID, {
        loadRunHistory: () => tenantAHistory.promise,
      });
    });

    expect(shouldClearStudyProcessingState(tenantAIdentity, tenantBIdentity)).toBe(true);
    act(() => contextValue.clearStudyProcessingState());
    expect(contextValue.getStudySummary(sameStudyUID)).toBeUndefined();
    expect(contextValue.getRunHistoryEntry(sameStudyUID).status).toBe('idle');

    await act(async () => {
      tenantAHistory.resolve({ history: studyProcessingRunHistoryFixture, partial: false });
      await historyRequest;
    });
    expect(contextValue.getRunHistoryEntry(sameStudyUID).status).toBe('idle');

    const tenantBSummary = {
      ...studyProcessingSummaryFixtures.waiting,
      studyInstanceUID: sameStudyUID,
      updatedAt: '2026-08-07T16:00:00Z',
    };
    act(() => contextValue.receiveSnapshot([tenantBSummary]));

    expect(contextValue.getStudySummary(sameStudyUID)).toBe(tenantBSummary);
    expect(contextValue.getStudySummary(sameStudyUID)).not.toBe(
      studyProcessingSummaryFixtures.processing
    );
  });
});
