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

function renderProvider() {
  renderer = TestRenderer.create(
    React.createElement(StudyProcessingProvider, null, React.createElement(ContextConsumer))
  );
}

describe('StudyProcessingProvider run-history transport override', () => {
  afterEach(() => {
    if (renderer) {
      act(() => renderer.unmount());
    }
  });

  test('deduplicates requests and reuses history loaded through the REST override', async () => {
    let resolveRequest!: (response: RunHistoryTransportResponse) => void;
    const loadRunHistory = jest.fn(
      () =>
        new Promise<RunHistoryTransportResponse>(resolve => {
          resolveRequest = resolve;
        })
    );
    const transport: StudyProcessingRunHistoryTransport = { loadRunHistory };

    act(renderProvider);

    let firstRequest!: Promise<void>;
    let duplicateRequest!: Promise<void>;
    act(() => {
      firstRequest = contextValue.ensureRunHistory(
        studyProcessingRunHistoryFixture.studyInstanceUID,
        transport
      );
      duplicateRequest = contextValue.ensureRunHistory(
        studyProcessingRunHistoryFixture.studyInstanceUID,
        transport
      );
    });

    expect(firstRequest).toBe(duplicateRequest);
    expect(loadRunHistory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest({ history: studyProcessingRunHistoryFixture, partial: false });
      await firstRequest;
    });

    await act(async () => {
      await contextValue.ensureRunHistory(
        studyProcessingRunHistoryFixture.studyInstanceUID,
        transport
      );
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(1);
    expect(
      contextValue.getRunHistoryEntry(studyProcessingRunHistoryFixture.studyInstanceUID).status
    ).toBe('ready');
  });

  test('uses the REST override again only for an explicit refresh', async () => {
    const loadRunHistory = jest.fn().mockResolvedValue({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    });
    const transport: StudyProcessingRunHistoryTransport = { loadRunHistory };

    act(renderProvider);

    await act(async () => {
      await contextValue.ensureRunHistory(
        studyProcessingRunHistoryFixture.studyInstanceUID,
        transport
      );
      await contextValue.refreshRunHistory(
        studyProcessingRunHistoryFixture.studyInstanceUID,
        transport
      );
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(2);
  });
});
