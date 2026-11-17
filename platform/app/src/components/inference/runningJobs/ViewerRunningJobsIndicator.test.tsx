import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import english from '../../../../../i18n/src/locales/en-US/AIModelButton.json';
import type { StudyProcessingSummary } from '@pacs-ai/extension-core/src/studyProcessing/types';
import { isStudyGrowing } from '../studyRefresh/studyGrowingStore';
import { RUNNING_JOBS_COLLAPSED_STORAGE_KEY } from './useRunningJobsCardState';
import { pendingRun, processingRun, STUDY_UID, viewerResult } from './testSupport';
import {
  ViewerRunningJobsIndicator,
  type ViewerRunningJobsIndicatorProps,
} from './ViewerRunningJobsIndicator';

const mockInferenceProcessing = {
  canViewStudyProcessing: true,
  canUseStudyProcessingREST: true,
};

jest.mock('@pacs-ai/extension-core/src/inferenceProcessing/InferenceProcessingProvider', () => ({
  useOptionalInferenceProcessing: () => mockInferenceProcessing,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      jest
        .requireActual('./testSupport')
        .translate(
          jest.requireActual('../../../../../i18n/src/locales/en-US/AIModelButton.json'),
          key,
          options
        ),
  }),
}));

const START = Date.parse('2026-11-10T10:00:00Z');

function processingRepository(summaries: StudyProcessingSummary[] = []) {
  return {
    loadWorklistStudyStatuses: jest
      .fn()
      .mockResolvedValue({ summaries, limit: 25, offset: 0, hasMore: false }),
    loadProcessingRunDetail: jest.fn().mockResolvedValue(processingRun()),
  };
}

function activeSummary(): StudyProcessingSummary {
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
  };
}

const settle = () =>
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

describe('ViewerRunningJobsIndicator', () => {
  let renderer: ReactTestRenderer | null = null;
  let props: ViewerRunningJobsIndicatorProps;

  async function render(overrides: Partial<ViewerRunningJobsIndicatorProps> = {}) {
    props = { ...props, ...overrides };
    await act(async () => {
      if (renderer) {
        renderer.update(<ViewerRunningJobsIndicator {...props} />);
      } else {
        renderer = TestRenderer.create(<ViewerRunningJobsIndicator {...props} />);
      }
    });
    await settle();
  }

  const byTestId = (id: string) => renderer!.root.findAllByProps({ 'data-testid': id });
  const elapsed = () => byTestId('running-jobs-elapsed').map(node => node.children.join(''));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
    window.localStorage.clear();
    mockInferenceProcessing.canViewStudyProcessing = true;
    mockInferenceProcessing.canUseStudyProcessingREST = true;
    props = {
      studyInstanceUID: STUDY_UID,
      pendingRuns: [],
      processingRepository: processingRepository(),
    };
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
    jest.useRealTimers();
  });

  test('shows nothing and runs no timer while idle', async () => {
    await render();
    expect(renderer!.toJSON()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('ticks the elapsed time every second from the start of the run', async () => {
    await render({ pendingRuns: [pendingRun({ requestedAt: START - 58_000 })] });
    expect(elapsed()).toEqual(['00:58']);

    await advance(1000);
    expect(elapsed()).toEqual(['00:59']);
    await advance(1000);
    expect(elapsed()).toEqual(['01:00']);
    await advance(65_000);
    expect(elapsed()).toEqual(['02:05']);
  });

  test('keeps a finished run for a few seconds, opens its result, then disappears', async () => {
    const run = pendingRun({ requestedAt: START - 30_000 });
    const onOpenResult = jest.fn();
    await render({ pendingRuns: [run], onOpenResult });
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('queued');

    await advance(10_000);
    const result = viewerResult();
    await render({
      pendingRuns: [],
      endedRuns: [{ run, outcome: 'completed', result, endedAt: Date.now(), foreground: false }],
    });
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('done');
    expect(byTestId('running-jobs-spinner')).toHaveLength(0);

    // The elapsed time is frozen at the end of the run.
    await advance(3000);
    expect(elapsed()).toEqual(['00:40']);
    act(() => byTestId('running-jobs-open-result')[0].props.onClick());
    expect(onOpenResult).toHaveBeenCalledWith(result);

    await advance(3000);
    expect(renderer!.toJSON()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('is hidden while the foreground pop-up shows the same run', async () => {
    const run = pendingRun();
    await render({ pendingRuns: [run], foregroundRun: run });
    expect(renderer!.toJSON()).toBeNull();

    // "Continue in background".
    await render({ foregroundRun: null });
    expect(byTestId('running-jobs-row')).toHaveLength(1);
  });

  test('follows the automatic processing of the study with its counts', async () => {
    const repo = processingRepository([activeSummary()]);
    await render({ processingRepository: repo, processingPollIntervalMs: 5000 });

    const text = JSON.stringify(renderer!.toJSON());
    expect(text).toContain('Automatic analysis');
    expect(text).toContain('2 of 7 models');
    expect(byTestId('running-jobs-progress')[0].props['aria-valuenow']).toBe(2);
    // The study identifier is never rendered.
    expect(text).not.toContain(STUDY_UID);

    repo.loadProcessingRunDetail.mockResolvedValue(
      processingRun({
        phase: 'TERMINAL',
        outcome: 'SUCCESS',
        queuedModels: 0,
        runningModels: 0,
        completedModels: 6,
      })
    );
    await advance(5000);
    expect(byTestId('running-jobs-row')[0].props['data-state']).toBe('done');
    await advance(6000);
    expect(renderer!.toJSON()).toBeNull();
  });

  test('does not query processing status without access to it', async () => {
    mockInferenceProcessing.canUseStudyProcessingREST = false;
    const repo = processingRepository([activeSummary()]);
    await render({ processingRepository: repo, pendingRuns: [pendingRun()] });

    expect(repo.loadWorklistStudyStatuses).not.toHaveBeenCalled();
    expect(byTestId('running-jobs-row')).toHaveLength(1);
  });

  test('collapses to a pill and remembers it', async () => {
    await render({
      pendingRuns: [pendingRun(), pendingRun({ key: 'container-2', runId: 'run-2' })],
    });
    act(() => byTestId('running-jobs-collapse')[0].props.onClick());

    expect(byTestId('running-jobs-row')).toHaveLength(0);
    expect(byTestId('running-jobs-pill')[0].children.length).toBeGreaterThan(0);
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      english.RunningJobsCountRunning.replace('{{total}}', '2')
    );
    expect(window.localStorage.getItem(RUNNING_JOBS_COLLAPSED_STORAGE_KEY)).toBe('1');

    act(() => renderer!.unmount());
    renderer = null;
    await render();
    expect(byTestId('running-jobs-pill')).toHaveLength(1);
  });

  test('stays closed until a new run starts', async () => {
    const first = pendingRun();
    await render({ pendingRuns: [first] });
    act(() => byTestId('running-jobs-close')[0].props.onClick());
    expect(renderer!.toJSON()).toBeNull();

    await advance(20_000);
    expect(renderer!.toJSON()).toBeNull();

    await render({
      pendingRuns: [
        first,
        pendingRun({ key: 'container-2', modelName: 'EchoPrime', runId: 'run-2' }),
      ],
    });
    expect(byTestId('running-jobs-row')).toHaveLength(2);
  });

  it('tells the study refresh button while the study is still growing', async () => {
    const repository = processingRepository([activeSummary()]);
    repository.loadProcessingRunDetail.mockResolvedValue(
      processingRun({ phase: 'QUEUED', waitingReason: 'study_growing' })
    );
    expect(isStudyGrowing(STUDY_UID)).toBe(false);

    await render({ processingRepository: repository });
    expect(isStudyGrowing(STUDY_UID)).toBe(true);

    // The study is stable: the run starts computing.
    repository.loadProcessingRunDetail.mockResolvedValue(processingRun({ phase: 'PROCESSING' }));
    await advance(5_000);
    expect(isStudyGrowing(STUDY_UID)).toBe(false);

    repository.loadProcessingRunDetail.mockResolvedValue(
      processingRun({ phase: 'QUEUED', waitingReason: 'study_growing' })
    );
    await advance(5_000);
    expect(isStudyGrowing(STUDY_UID)).toBe(true);
    act(() => renderer?.unmount());
    renderer = null;
    expect(isStudyGrowing(STUDY_UID)).toBe(false);
  });
});
