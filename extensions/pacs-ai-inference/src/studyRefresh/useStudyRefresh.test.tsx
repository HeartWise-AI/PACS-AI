import React from 'react';
import { act, render, type RenderResult } from '@testing-library/react';
import type { StudySeriesSnapshot } from './reloadStudySeries';
import { rememberStudySourceModality } from './sourceModality';
import {
  countStudyChanges,
  useStudyRefresh,
  type StudyRefreshController,
  type StudyRefreshRepository,
  type StudyRefreshState,
  type UseStudyRefreshOptions,
} from './useStudyRefresh';

const STUDY_UID = '1.2.3';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

function snapshot(series: string[], instances = series.length): StudySeriesSnapshot {
  return { seriesInstanceUIDs: series, instances };
}

function repository(overrides: Partial<StudyRefreshRepository> = {}) {
  return {
    loadModalities: jest.fn().mockResolvedValue({ MHI_PACS: {}, ARCHIVE: {} }),
    retrieveStudy: jest.fn().mockResolvedValue(['job-1', 'job-2']),
    loadJobs: jest.fn().mockResolvedValue([{ progress: 100 }, { progress: 100 }]),
    ...overrides,
  } as jest.Mocked<StudyRefreshRepository>;
}

describe('useStudyRefresh', () => {
  let renderer: RenderResult | null = null;
  let controller: StudyRefreshController;
  let phases: StudyRefreshState[];

  function Harness(props: UseStudyRefreshOptions) {
    controller = useStudyRefresh(props);
    const last = phases[phases.length - 1];
    if (last !== controller.state) {
      phases.push(controller.state);
    }
    return null;
  }

  // The viewer's store before the reload, and what the reload adds to it.
  function viewerStore(before: StudySeriesSnapshot, after: StudySeriesSnapshot) {
    let current = before;
    return {
      getSeriesSnapshot: jest.fn(() => current),
      reloadSeries: jest.fn(async () => {
        current = after;
      }),
    };
  }

  function mount(options: Partial<UseStudyRefreshOptions> = {}) {
    const sessionStorage = memoryStorage();
    rememberStudySourceModality(STUDY_UID, 'MHI_PACS', sessionStorage);
    const props: UseStudyRefreshOptions = {
      studyInstanceUID: STUDY_UID,
      repository: repository(),
      ...viewerStore(snapshot(['s1', 's2']), snapshot(['s1', 's2'])),
      sessionStorage,
      localStorage: memoryStorage(),
      wait: () => Promise.resolve(),
      ...options,
    };
    // A legacy root renders every intermediate state, as the phase log below expects.
    renderer = render(<Harness {...props} />, { legacyRoot: true });
    return props;
  }

  const refresh = () =>
    act(async () => {
      await controller.refresh();
    });

  beforeEach(() => {
    phases = [];
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    jest.useRealTimers();
  });

  it('retrieves from the PACS source, waits for the jobs, reloads and counts the new series', async () => {
    const api = repository({
      loadJobs: jest
        .fn()
        .mockResolvedValueOnce([{ progress: 20 }, { progress: 60 }])
        .mockResolvedValueOnce([{ progress: 100 }, { progress: 100 }]),
    });
    const store = viewerStore(
      snapshot(['s1', 's2'], 2),
      snapshot(['s1', 's2', 's3', 's4', 's5'], 5)
    );
    mount({ repository: api, ...store });

    expect(controller.state.phase).toBe('idle');
    await refresh();

    expect(api.retrieveStudy).toHaveBeenCalledWith({
      modalityId: 'MHI_PACS',
      studyInstanceUID: STUDY_UID,
    });
    expect(api.loadJobs).toHaveBeenCalledTimes(2);
    expect(api.loadJobs).toHaveBeenCalledWith(['job-1', 'job-2']);
    expect(store.reloadSeries).toHaveBeenCalledWith(STUDY_UID);
    expect(phases.map(state => state.phase)).toEqual([
      'idle',
      'resolving',
      'retrieving',
      'retrieving',
      'retrieving',
      'reloading',
      'done',
    ]);
    expect(
      phases.filter(state => state.phase === 'retrieving').map(state => state.progress)
    ).toEqual([null, 40, 100]);
    expect(controller.state).toEqual({
      phase: 'done',
      progress: null,
      result: { newSeries: 3, newImages: 3, retrievedFromPACS: true },
      error: null,
    });
    expect(controller.busy).toBe(false);
  });

  it('reports "up to date" when the local copy already has every series of the PACS', async () => {
    // The server answers "duplicate": the repository resolves no job.
    const api = repository({ retrieveStudy: jest.fn().mockResolvedValue([]) });
    const props = mount({ repository: api });

    await refresh();

    expect(api.loadJobs).not.toHaveBeenCalled();
    expect(props.reloadSeries).toHaveBeenCalledTimes(1);
    expect(controller.state.result).toEqual({
      newSeries: 0,
      newImages: 0,
      retrievedFromPACS: true,
    });
  });

  it('resolves the source from the work list selection, then the only modality', async () => {
    const api = repository();
    mount({
      repository: api,
      sessionStorage: memoryStorage(),
      localStorage: memoryStorage({ selectedDICOMModality: 'ARCHIVE' }),
    });
    await refresh();
    expect(api.retrieveStudy).toHaveBeenCalledWith({
      modalityId: 'ARCHIVE',
      studyInstanceUID: STUDY_UID,
    });
    renderer?.unmount();

    const single = repository({
      loadModalities: jest.fn().mockResolvedValue({ ONLY_PACS: { targetCMoveEnabled: true } }),
    });
    mount({ repository: single, sessionStorage: memoryStorage() });
    await refresh();
    expect(single.retrieveStudy).toHaveBeenCalledWith({
      modalityId: 'ONLY_PACS',
      studyInstanceUID: STUDY_UID,
    });
  });

  it('only reloads the local copy when the PACS source cannot be determined', async () => {
    const api = repository();
    const store = viewerStore(snapshot(['s1']), snapshot(['s1', 's2']));
    mount({ repository: api, ...store, sessionStorage: memoryStorage() });

    await refresh();

    expect(api.retrieveStudy).not.toHaveBeenCalled();
    expect(api.loadJobs).not.toHaveBeenCalled();
    expect(store.reloadSeries).toHaveBeenCalledWith(STUDY_UID);
    expect(phases.map(state => state.phase)).toEqual(['idle', 'resolving', 'reloading', 'done']);
    expect(controller.state.result).toEqual({
      newSeries: 1,
      newImages: 1,
      retrievedFromPACS: false,
    });
  });

  it('reports a failed retrieval job and still reloads the local copy', async () => {
    const api = repository({
      loadJobs: jest.fn().mockResolvedValue([{ progress: 30, state: 'Failure' }]),
    });
    const store = viewerStore(snapshot(['s1']), snapshot(['s1', 's2']));
    mount({ repository: api, ...store });

    await refresh();

    expect(store.reloadSeries).toHaveBeenCalledTimes(1);
    expect(controller.state).toEqual({
      phase: 'error',
      progress: null,
      result: { newSeries: 1, newImages: 1, retrievedFromPACS: false },
      error: 'retrieveFailed',
    });
  });

  it('reports a retrieval that cannot be started and one that takes too long', async () => {
    mount({ repository: repository({ retrieveStudy: jest.fn().mockRejectedValue(new Error()) }) });
    await refresh();
    expect(controller.state.error).toBe('retrieveFailed');
    renderer?.unmount();

    let time = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => time);
    mount({
      repository: repository({ loadJobs: jest.fn().mockResolvedValue([{ progress: 10 }]) }),
      timeoutMs: 2_000,
      pollIntervalMs: 1_000,
      wait: async ms => {
        time += ms;
      },
    });
    await refresh();
    expect(controller.state.error).toBe('retrieveTimedOut');
    jest.restoreAllMocks();
  });

  it('reports a reload that fails', async () => {
    mount({ reloadSeries: jest.fn().mockRejectedValue(new Error('metadata')) });

    await refresh();

    expect(controller.state).toEqual({
      phase: 'error',
      progress: null,
      result: null,
      error: 'reloadFailed',
    });
  });

  it('ignores a second request while a refresh is running', async () => {
    let finishRetrieve: (jobIds: string[]) => void = () => undefined;
    const api = repository({
      retrieveStudy: jest
        .fn()
        .mockImplementationOnce(() => new Promise<string[]>(resolve => (finishRetrieve = resolve)))
        .mockResolvedValue([]),
    });
    mount({ repository: api });

    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = controller.refresh();
      for (let turn = 0; turn < 20; turn++) {
        await Promise.resolve();
      }
    });
    expect(controller.busy).toBe(true);
    await refresh();
    expect(api.retrieveStudy).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRetrieve([]);
      await first;
    });
    expect(controller.state.phase).toBe('done');

    await refresh();
    expect(api.retrieveStudy).toHaveBeenCalledTimes(2);
  });

  it('shows the result briefly, then is idle again', async () => {
    jest.useFakeTimers();
    mount({ resultLingerMs: 6_000 });

    await refresh();
    expect(controller.state.phase).toBe('done');

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(controller.state.phase).toBe('done');
    expect(controller.state.result).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(7_000);
    });
    expect(controller.state).toEqual({ phase: 'idle', progress: null, result: null, error: null });
  });

  it('does nothing without a study and stops reporting once unmounted', async () => {
    const props = mount({ studyInstanceUID: null });
    await refresh();
    expect(props.reloadSeries).not.toHaveBeenCalled();
    renderer?.unmount();

    let finishReload: () => void = () => undefined;
    const reloadSeries = jest.fn(() => new Promise<void>(resolve => (finishReload = resolve)));
    mount({ reloadSeries });
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = controller.refresh();
      for (let turn = 0; turn < 20; turn++) {
        await Promise.resolve();
      }
    });
    expect(reloadSeries).toHaveBeenCalledTimes(1);
    const seen = phases.length;
    renderer?.unmount();
    renderer = null;
    finishReload();
    await pending;
    expect(phases).toHaveLength(seen);
  });
});

describe('countStudyChanges', () => {
  it('counts the series the viewer did not have and the added images', () => {
    expect(countStudyChanges(snapshot(['s1', 's2'], 10), snapshot(['s2', 's1', 's3'], 14))).toEqual(
      {
        newSeries: 1,
        newImages: 4,
      }
    );
    expect(countStudyChanges(snapshot(['s1'], 3), snapshot(['s1'], 5))).toEqual({
      newSeries: 0,
      newImages: 2,
    });
    expect(countStudyChanges(snapshot(['s1'], 3), snapshot(['s1'], 3))).toEqual({
      newSeries: 0,
      newImages: 0,
    });
  });
});
