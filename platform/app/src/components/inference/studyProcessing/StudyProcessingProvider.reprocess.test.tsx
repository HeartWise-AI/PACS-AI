import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingRunHistoryFixture } from './fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import type { CreatedStudyProcessingRun } from './types';
import { StudyReprocessError } from './reprocessTransport';

const studyInstanceUID = studyProcessingRunHistoryFixture.studyInstanceUID;
const createdRun: CreatedStudyProcessingRun = {
  id: 'manual-run-4',
  runNumber: 4,
  trigger: 'MANUAL_REPROCESS',
  phase: 'QUEUED',
  expectedModels: 3,
};

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return null;
}

describe('StudyProcessingProvider reprocessing', () => {
  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('submits once and refreshes authoritative summary and history after success', async () => {
    const reprocessStudy = jest.fn().mockResolvedValue(createdRun);
    const loadRunHistory = jest.fn().mockResolvedValue({
      history: {
        ...studyProcessingRunHistoryFixture,
        runs: [
          {
            ...studyProcessingRunHistoryFixture.runs[0],
            id: createdRun.id,
            runNumber: createdRun.runNumber,
            trigger: createdRun.trigger,
          },
          ...studyProcessingRunHistoryFixture.runs,
        ],
      },
      partial: false,
    });
    const refreshVisibleStudySnapshot = jest.fn();

    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider
          reprocessTransport={{ reprocessStudy }}
          runHistoryTransport={{ loadRunHistory }}
        >
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    await act(async () => {
      await contextValue.reprocessStudy(studyInstanceUID, refreshVisibleStudySnapshot);
    });

    expect(reprocessStudy).toHaveBeenCalledTimes(1);
    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(1);
    expect(loadRunHistory).toHaveBeenCalledWith(studyInstanceUID);
    expect(contextValue.getStudyReprocessRequestEntry(studyInstanceUID)).toEqual({
      status: 'success',
      createdRun,
      error: null,
    });
    expect(contextValue.getRunHistoryEntry(studyInstanceUID).history?.runs[0].id).toBe(
      createdRun.id
    );
  });

  it('shares duplicate submissions without duplicating reconciliation', async () => {
    let resolveRequest!: (run: CreatedStudyProcessingRun) => void;
    const reprocessStudy = jest.fn(
      () =>
        new Promise<CreatedStudyProcessingRun>(resolve => {
          resolveRequest = resolve;
        })
    );
    const loadRunHistory = jest.fn().mockResolvedValue({
      history: studyProcessingRunHistoryFixture,
      partial: false,
    });
    const refreshVisibleStudySnapshot = jest.fn();

    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider
          reprocessTransport={{ reprocessStudy }}
          runHistoryTransport={{ loadRunHistory }}
        >
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    let first!: Promise<CreatedStudyProcessingRun>;
    let duplicate!: Promise<CreatedStudyProcessingRun>;
    act(() => {
      first = contextValue.reprocessStudy(studyInstanceUID, refreshVisibleStudySnapshot);
      duplicate = contextValue.reprocessStudy(studyInstanceUID, refreshVisibleStudySnapshot);
    });
    expect(contextValue.getStudyReprocessRequestEntry(studyInstanceUID).status).toBe('submitting');

    await act(async () => {
      resolveRequest(createdRun);
      await Promise.all([first, duplicate]);
    });

    expect(reprocessStudy).toHaveBeenCalledTimes(1);
    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(1);
    expect(loadRunHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps existing processing data and records a safe request failure', async () => {
    const existingError = new Error('Unable to reprocess study.');
    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider
          reprocessTransport={{ reprocessStudy: jest.fn().mockRejectedValue(existingError) }}
        >
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    await act(async () => {
      await expect(contextValue.reprocessStudy(studyInstanceUID)).rejects.toBe(existingError);
    });

    expect(contextValue.getStudyReprocessRequestEntry(studyInstanceUID)).toEqual({
      status: 'error',
      createdRun: null,
      error: existingError,
    });
  });

  it('refreshes authoritative status after an active-run conflict', async () => {
    const refreshVisibleStudySnapshot = jest.fn();
    const conflict = new StudyReprocessError('Active run.', 409);
    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider
          reprocessTransport={{ reprocessStudy: jest.fn().mockRejectedValue(conflict) }}
        >
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });

    await act(async () => {
      await expect(
        contextValue.reprocessStudy(studyInstanceUID, refreshVisibleStudySnapshot)
      ).rejects.toBe(conflict);
    });

    expect(refreshVisibleStudySnapshot).toHaveBeenCalledTimes(1);
    expect(contextValue.getStudyReprocessRequestEntry(studyInstanceUID).status).toBe('error');
  });
});
