import React from 'react';
import { act, render, type RenderResult } from '@testing-library/react';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import type { BulkStudyReprocessResponse } from './types';

const response: BulkStudyReprocessResponse = {
  acceptedCount: 1,
  rejectedCount: 1,
  results: [
    {
      studyInstanceUID: 'study-a',
      accepted: true,
      run: {
        id: 'run-a',
        runNumber: 2,
        trigger: 'MANUAL_REPROCESS',
        phase: 'QUEUED',
        expectedModels: 3,
      },
    },
    {
      studyInstanceUID: 'study-b',
      accepted: false,
      errorCode: 'DUPLICATE_RECORD',
      retryAfterSeconds: null,
    },
  ],
};

let contextValue: StudyProcessingContextValue;
let renderer: RenderResult;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return null;
}

describe('StudyProcessingProvider bulk reprocessing', () => {
  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('records every result and refreshes accepted history plus the visible snapshot', async () => {
    const reprocessStudies = jest.fn().mockResolvedValue(response);
    const loadRunHistory = jest.fn().mockResolvedValue({
      history: { studyInstanceUID: 'study-a', runs: [] },
      partial: false,
    });
    const refreshVisibleStudySnapshot = jest.fn();

    act(() => {
      renderer = render(
        <StudyProcessingProvider
          bulkReprocessTransport={{ reprocessStudies }}
          runHistoryTransport={{ loadRunHistory }}
        >
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    await act(async () => {
      await contextValue.reprocessStudies(
        ['study-a', 'study-b', 'study-a'],
        refreshVisibleStudySnapshot
      );
    });

    expect(reprocessStudies).toHaveBeenCalledWith(['study-a', 'study-b']);
    expect(loadRunHistory).toHaveBeenCalledWith('study-a');
    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(1);
    expect(contextValue.getStudyReprocessRequestEntry('study-a')).toMatchObject({
      status: 'success',
      createdRun: response.results[0].accepted ? response.results[0].run : null,
    });
    expect(contextValue.getStudyReprocessRequestEntry('study-b')).toMatchObject({
      status: 'error',
      error: { status: 409, errorCode: 'DUPLICATE_RECORD' },
    });
  });

  it('marks every selected study failed when the batch request itself fails', async () => {
    const requestError = new Error('Unable to reprocess the selected studies.');
    act(() => {
      renderer = render(
        <StudyProcessingProvider
          bulkReprocessTransport={{
            reprocessStudies: jest.fn().mockRejectedValue(requestError),
          }}
        >
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    await act(async () => {
      await expect(contextValue.reprocessStudies(['study-a', 'study-b'])).rejects.toBe(
        requestError
      );
    });

    expect(contextValue.getStudyReprocessRequestEntry('study-a')).toMatchObject({
      status: 'error',
      error: requestError,
    });
    expect(contextValue.getStudyReprocessRequestEntry('study-b')).toMatchObject({
      status: 'error',
      error: requestError,
    });
  });
});
