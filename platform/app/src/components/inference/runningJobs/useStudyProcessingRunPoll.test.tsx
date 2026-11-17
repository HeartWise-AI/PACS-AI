import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import type { StudyProcessingSummary } from '@pacs-ai/extension-core/src/studyProcessing/types';
import { processingRun, STUDY_UID } from './testSupport';
import {
  useStudyProcessingRunPoll,
  type StudyProcessingRunPollRepository,
  type StudyProcessingRunPollState,
  type UseStudyProcessingRunPollOptions,
} from './useStudyProcessingRunPoll';

function summary(overrides: Partial<StudyProcessingSummary> = {}): StudyProcessingSummary {
  const { id, modelExecutions, createdAt, ...run } = processingRun();
  void modelExecutions;
  void createdAt;
  return {
    ...run,
    runId: id,
    ingestionStatus: 'RETRIEVED',
    retrievalState: null,
    retrievalError: null,
    lifecycle: 'PROCESSING',
    ...overrides,
  };
}

function repository(
  summaries: StudyProcessingSummary[],
  overrides: Partial<StudyProcessingRunPollRepository> = {}
) {
  return {
    loadWorklistStudyStatuses: jest
      .fn()
      .mockResolvedValue({ summaries, limit: 25, offset: 0, hasMore: false }),
    loadProcessingRunDetail: jest.fn().mockResolvedValue(processingRun()),
    ...overrides,
  } as jest.Mocked<StudyProcessingRunPollRepository>;
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

describe('useStudyProcessingRunPoll', () => {
  let renderer: ReactTestRenderer | null = null;
  let state: StudyProcessingRunPollState | null = null;

  function Probe(props: UseStudyProcessingRunPollOptions) {
    state = useStudyProcessingRunPoll(props);
    return null;
  }

  async function render(props: Partial<UseStudyProcessingRunPollOptions>) {
    const element = (
      <Probe
        studyInstanceUID={STUDY_UID}
        enabled
        pollIntervalMs={5000}
        {...props}
      />
    );
    await act(async () => {
      if (renderer) {
        renderer.update(element);
      } else {
        renderer = TestRenderer.create(element);
      }
    });
    await flush();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-10T10:01:00Z'));
    setVisibility('visible');
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    state = null;
    setVisibility('visible');
    jest.useRealTimers();
  });

  test('checks the study once and does not poll while nothing is active', async () => {
    const repo = repository([summary({ phase: 'TERMINAL', outcome: 'SUCCESS' })]);
    await render({ repository: repo });

    expect(repo.loadWorklistStudyStatuses).toHaveBeenCalledTimes(1);
    expect(repo.loadWorklistStudyStatuses).toHaveBeenCalledWith({ studyInstanceUIDs: [STUDY_UID] });
    expect(repo.loadProcessingRunDetail).not.toHaveBeenCalled();
    expect(state).toEqual({ run: null, seenAt: null, endedAt: null });

    await advance(60_000);
    expect(repo.loadWorklistStudyStatuses).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('polls the run detail while the run is active and stops when it ends', async () => {
    const repo = repository([summary()]);
    await render({ repository: repo });

    expect(repo.loadProcessingRunDetail).toHaveBeenCalledWith('auto-run-1');
    expect(state!.run).toMatchObject({ id: 'auto-run-1', phase: 'PROCESSING' });
    expect(state!.seenAt).toBe(Date.parse('2026-11-10T10:01:00Z'));
    expect(state!.endedAt).toBeNull();

    repo.loadProcessingRunDetail.mockResolvedValue(processingRun({ completedModels: 4 }));
    await advance(4999);
    expect(repo.loadProcessingRunDetail).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(repo.loadProcessingRunDetail).toHaveBeenCalledTimes(2);
    expect(state!.run!.completedModels).toBe(4);
    expect(state!.seenAt).toBe(Date.parse('2026-11-10T10:01:00Z'));

    repo.loadProcessingRunDetail.mockResolvedValue(
      processingRun({ phase: 'TERMINAL', outcome: 'SUCCESS' })
    );
    await advance(5000);
    expect(state!.run!.phase).toBe('TERMINAL');
    expect(state!.endedAt).toBe(Date.parse('2026-11-10T10:01:10Z'));

    await advance(60_000);
    expect(repo.loadProcessingRunDetail).toHaveBeenCalledTimes(3);
    // The status was only read for the first check.
    expect(repo.loadWorklistStudyStatuses).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('shows the counts of the status when the run detail cannot be loaded', async () => {
    const repo = repository([summary()], {
      loadProcessingRunDetail: jest.fn().mockRejectedValue(new Error('forbidden')),
    });
    await render({ repository: repo });

    expect(state!.run).toMatchObject({
      id: 'auto-run-1',
      expectedModels: 7,
      completedModels: 1,
      modelExecutions: [],
    });

    await advance(5000);
    expect(repo.loadWorklistStudyStatuses).toHaveBeenCalledTimes(2);
  });

  test('does not poll while the tab is hidden and checks again when it is shown', async () => {
    const repo = repository([summary()]);
    await render({ repository: repo });
    expect(repo.loadProcessingRunDetail).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('hidden'));
    await advance(30_000);
    expect(repo.loadProcessingRunDetail).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);

    await act(async () => setVisibility('visible'));
    await flush();
    expect(repo.loadProcessingRunDetail).toHaveBeenCalledTimes(2);
    await advance(5000);
    expect(repo.loadProcessingRunDetail).toHaveBeenCalledTimes(3);
  });

  test('does nothing when disabled or without a study', async () => {
    const repo = repository([summary()]);
    await render({ repository: repo, enabled: false });
    await advance(30_000);
    expect(repo.loadWorklistStudyStatuses).not.toHaveBeenCalled();
    expect(state).toEqual({ run: null, seenAt: null, endedAt: null });

    await render({ repository: repo, studyInstanceUID: null });
    expect(repo.loadWorklistStudyStatuses).not.toHaveBeenCalled();
  });

  test('checks again when the refresh key changes and forgets the run of another study', async () => {
    const repo = repository([]);
    await render({ repository: repo, refreshKey: 0 });
    expect(repo.loadWorklistStudyStatuses).toHaveBeenCalledTimes(1);
    expect(state!.run).toBeNull();

    repo.loadWorklistStudyStatuses.mockResolvedValue({
      summaries: [summary()],
      limit: 25,
      offset: 0,
      hasMore: false,
    });
    await render({ repository: repo, refreshKey: 1 });
    expect(repo.loadWorklistStudyStatuses).toHaveBeenCalledTimes(2);
    expect(state!.run).not.toBeNull();

    repo.loadWorklistStudyStatuses.mockResolvedValue({
      summaries: [],
      limit: 25,
      offset: 0,
      hasMore: false,
    });
    await render({ repository: repo, refreshKey: 1, studyInstanceUID: '9.9.9' });
    expect(state!.run).toBeNull();
    expect(repo.loadWorklistStudyStatuses).toHaveBeenLastCalledWith({
      studyInstanceUIDs: ['9.9.9'],
    });
  });

  test('keeps the last known run through a transient failure', async () => {
    const repo = repository([summary()]);
    await render({ repository: repo });

    repo.loadProcessingRunDetail.mockRejectedValue(new Error('network'));
    repo.loadWorklistStudyStatuses.mockRejectedValue(new Error('network'));
    await advance(5000);
    expect(state!.run).toMatchObject({ id: 'auto-run-1', phase: 'PROCESSING' });

    repo.loadProcessingRunDetail.mockResolvedValue(processingRun({ completedModels: 5 }));
    await advance(5000);
    expect(state!.run!.completedModels).toBe(5);
  });
});
