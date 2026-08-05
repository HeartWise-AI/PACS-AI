import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingRunHistoryFixture } from './fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import type {
  RunHistoryTransportResponse,
  StudyProcessingRunHistoryTransport,
} from './runHistoryTransport';

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return null;
}

describe('StudyProcessingProvider run history', () => {
  afterEach(() => {
    act(() => {
      renderer.unmount();
    });
  });

  test('deduplicates lazy requests and reuses cached history', async () => {
    let resolveRequest!: (response: RunHistoryTransportResponse) => void;
    const loadRunHistory = jest.fn(
      () =>
        new Promise<RunHistoryTransportResponse>(resolve => {
          resolveRequest = resolve;
        })
    );
    const transport: StudyProcessingRunHistoryTransport = { loadRunHistory };

    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider runHistoryTransport={transport}>
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    const firstRequest = contextValue.ensureRunHistory(
      studyProcessingRunHistoryFixture.studyInstanceUID
    );
    const duplicateRequest = contextValue.ensureRunHistory(
      studyProcessingRunHistoryFixture.studyInstanceUID
    );

    expect(firstRequest).toBe(duplicateRequest);
    expect(loadRunHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({
        history: studyProcessingRunHistoryFixture,
        partial: false,
      });
      await firstRequest;
    });

    expect(
      contextValue.getRunHistoryEntry(studyProcessingRunHistoryFixture.studyInstanceUID)
    ).toEqual({
      status: 'ready',
      history: studyProcessingRunHistoryFixture,
      error: null,
    });

    await act(async () => {
      await contextValue.ensureRunHistory(studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(1);
  });

  test('refreshes cached history only when explicitly requested', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    }));

    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider runHistoryTransport={{ loadRunHistory }}>
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    await act(async () => {
      await contextValue.ensureRunHistory(studyProcessingRunHistoryFixture.studyInstanceUID);
      await contextValue.refreshRunHistory(studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(2);
  });

  test('clearing processing state also clears cached run history', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    }));

    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider runHistoryTransport={{ loadRunHistory }}>
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    await act(async () => {
      await contextValue.ensureRunHistory(studyProcessingRunHistoryFixture.studyInstanceUID);
    });
    act(() => {
      contextValue.clearStudyProcessingState();
    });

    expect(
      contextValue.getRunHistoryEntry(studyProcessingRunHistoryFixture.studyInstanceUID)
    ).toEqual({
      status: 'idle',
      history: null,
      error: null,
    });
  });
});
