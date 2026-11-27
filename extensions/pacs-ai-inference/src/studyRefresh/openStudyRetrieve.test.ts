import {
  createOpenStudyRepository,
  isStudyInLocalStore,
  prepareStudyForViewer,
  type OpenStudyRepository,
} from './openStudyRetrieve';
import { STUDY_SOURCE_MODALITY_STORAGE_KEY } from './sourceModality';

const UID = '1.2.840.10008.1';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function repository(overrides: Partial<OpenStudyRepository> = {}): OpenStudyRepository {
  return {
    loadModalities: jest.fn(async () => ({ PACS_QUERY: { allowMove: true } })),
    retrieveStudy: jest.fn(async () => []),
    loadJobs: jest.fn(async () => []),
    isStored: jest.fn(async () => false),
    ...overrides,
  };
}

const noWait = async () => undefined;

describe('prepareStudyForViewer (the work list open, for every study link)', () => {
  it('retrieves from the PACS source and opens once the first series is stored', async () => {
    const polls = [
      [
        { id: 'a', progress: 40, state: 'Running' },
        { id: 'b', progress: 0, state: 'Pending' },
      ],
      [
        { id: 'a', progress: 100, state: 'Success' },
        { id: 'b', progress: 10, state: 'Running' },
      ],
    ];
    const repo = repository({
      retrieveStudy: jest.fn(async () => [
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
      ]),
      loadJobs: jest.fn(async () => polls.shift() ?? []),
    });
    const progress: Array<number | null> = [];
    const session = memory();
    const outcome = await prepareStudyForViewer({
      studyInstanceUID: UID,
      repository: repo,
      onProgress: p => progress.push(p),
      wait: noWait,
      sessionStorage: session,
      localStorage: memory(),
    });
    expect(repo.retrieveStudy).toHaveBeenCalledWith({ modalityId: 'PACS_QUERY', studyInstanceUID: UID });
    expect(outcome).toEqual({ status: 'open', remainingJobIds: ['b'], modalityId: 'PACS_QUERY' });
    expect(progress).toEqual([0, 0, 50]);
    // The viewer's "Refresh study from PACS" knows the source.
    expect(session.getItem(STUDY_SOURCE_MODALITY_STORAGE_KEY)).toContain('PACS_QUERY');
    expect(repo.isStored).not.toHaveBeenCalled();
  });

  it('can wait for every series (studies after the first of a selection)', async () => {
    const polls = [
      [
        { id: 'a', progress: 100, state: 'Success' },
        { id: 'b', progress: 10, state: 'Running' },
      ],
      [
        { id: 'a', progress: 100, state: 'Success' },
        { id: 'b', progress: 100, state: 'Success' },
      ],
    ];
    const repo = repository({
      retrieveStudy: jest.fn(async () => [
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
      ]),
      loadJobs: jest.fn(async () => polls.shift() ?? []),
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: repo,
        openOnFirstSeries: false,
        wait: noWait,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'open', remainingJobIds: [], modalityId: 'PACS_QUERY' });
    expect(repo.loadJobs).toHaveBeenCalledTimes(2);

    // A later series failed: what arrived is opened, nothing left to follow.
    const partial = repository({
      retrieveStudy: jest.fn(async () => [{ id: 'a', order: 0 }, { id: 'b', order: 1 }]),
      loadJobs: jest.fn(async () => [
        { id: 'a', progress: 100, state: 'Success' },
        { id: 'b', progress: 30, state: 'Failure' },
      ]),
      isStored: jest.fn(async () => true),
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: partial,
        openOnFirstSeries: false,
        wait: noWait,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'open', remainingJobIds: [], modalityId: null });
  });

  it('opens at once when the local copy is already complete (no jobs)', async () => {
    const repo = repository();
    const outcome = await prepareStudyForViewer({
      studyInstanceUID: UID,
      repository: repo,
      sessionStorage: memory(),
      localStorage: memory(),
    });
    expect(outcome).toEqual({ status: 'open', remainingJobIds: [], modalityId: 'PACS_QUERY' });
    expect(repo.loadJobs).not.toHaveBeenCalled();
  });

  it('prefers the work list modality when the tenant has several', async () => {
    const repo = repository({
      loadModalities: jest.fn(async () => ({ A: {}, B: {} })),
    });
    await prepareStudyForViewer({
      studyInstanceUID: UID,
      repository: repo,
      sessionStorage: memory(),
      localStorage: memory({ selectedDICOMModality: 'B' }),
    });
    expect(repo.retrieveStudy).toHaveBeenCalledWith({ modalityId: 'B', studyInstanceUID: UID });
  });

  it('without a PACS source opens a stored copy, or fails with noSource', async () => {
    const twoSources = jest.fn(async () => ({ A: {}, B: {} }));
    const stored = repository({ loadModalities: twoSources, isStored: jest.fn(async () => true) });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: stored,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'open', remainingJobIds: [], modalityId: null });
    expect(stored.retrieveStudy).not.toHaveBeenCalled();

    const missing = repository({ loadModalities: twoSources });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: missing,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'failed', reason: 'noSource' });
  });

  it('when the PACS refuses, opens a stored copy or reports the failure', async () => {
    const refuse = jest.fn(async () => {
      throw new Error('C-MOVE failed');
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: repository({ retrieveStudy: refuse, isStored: jest.fn(async () => true) }),
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'open', remainingJobIds: [], modalityId: null });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: repository({ retrieveStudy: refuse }),
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'failed', reason: 'retrieveFailed' });
  });

  it('gives up when the first series fails or the retrieve takes too long', async () => {
    const failing = repository({
      retrieveStudy: jest.fn(async () => [{ id: 'a', order: 0 }]),
      loadJobs: jest.fn(async () => [{ id: 'a', progress: 20, state: 'Failure' }]),
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: failing,
        wait: noWait,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'failed', reason: 'retrieveFailed' });

    let t = 0;
    const slow = repository({
      retrieveStudy: jest.fn(async () => [{ id: 'a', order: 0 }]),
      loadJobs: jest.fn(async () => [{ id: 'a', progress: 10, state: 'Running' }]),
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: slow,
        timeoutMs: 5_000,
        now: () => t,
        wait: async ms => {
          t += ms;
        },
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'failed', reason: 'timedOut' });
  });

  it('opening a partial copy after a failure hands the still-running jobs to the viewer', async () => {
    const repo = repository({
      retrieveStudy: jest.fn(async () => [
        { id: 'a', order: 0 },
        { id: 'b', order: 1 },
        { id: 'c', order: 2 },
      ]),
      loadJobs: jest.fn(async () => [
        { id: 'a', progress: 30, state: 'Failure' },
        { id: 'b', progress: 40, state: 'Running' },
        { id: 'c', progress: 100, state: 'Success' },
      ]),
      isStored: jest.fn(async () => true),
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: repo,
        wait: noWait,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'open', remainingJobIds: ['b'], modalityId: null });

    // Status unreadable three times: every job is handed over.
    const blind = repository({
      retrieveStudy: jest.fn(async () => [{ id: 'a', order: 0 }, { id: 'b', order: 1 }]),
      loadJobs: jest.fn(async () => {
        throw new Error('502');
      }),
      isStored: jest.fn(async () => true),
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: blind,
        wait: noWait,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'open', remainingJobIds: ['a', 'b'], modalityId: null });
  });

  it('stops quietly when the page is left', async () => {
    let cancelled = false;
    const repo = repository({
      retrieveStudy: jest.fn(async () => {
        cancelled = true;
        return [{ id: 'a', order: 0 }];
      }),
    });
    expect(
      await prepareStudyForViewer({
        studyInstanceUID: UID,
        repository: repo,
        isCancelled: () => cancelled,
        sessionStorage: memory(),
        localStorage: memory(),
      })
    ).toEqual({ status: 'cancelled' });
    expect(repo.loadJobs).not.toHaveBeenCalled();
  });
});

describe('the api-pacs calls', () => {
  it('maps the retrieve answer, treats "duplicate" as nothing to wait for', async () => {
    const api = {
      GetDICOMModalities: jest.fn(async () => ({ data: { modalities: { A: {} } } })),
      RetrieveModalityStudy: jest.fn(async () => ({ data: [{ id: 'j1', order: 0 }, { id: '' }] })),
      GetJobsInfo: jest.fn(async () => ({ data: [{ id: 'j1', progress: 100 }] })),
    };
    const repo = createOpenStudyRepository(api as never, async () => true);
    expect(await repo.loadModalities()).toEqual({ A: {} });
    expect(await repo.retrieveStudy({ modalityId: 'A', studyInstanceUID: UID })).toEqual([
      { id: 'j1', order: 0 },
    ]);
    expect(await repo.loadJobs(['j1'])).toEqual([{ id: 'j1', progress: 100 }]);

    api.RetrieveModalityStudy.mockRejectedValueOnce({ errorCode: 'DUPLICATE_RECORD' });
    expect(await repo.retrieveStudy({ modalityId: 'A', studyInstanceUID: UID })).toEqual([]);
    api.RetrieveModalityStudy.mockRejectedValueOnce({ errorCode: 'MODALITY_ERROR' });
    await expect(repo.retrieveStudy({ modalityId: 'A', studyInstanceUID: UID })).rejects.toEqual({
      errorCode: 'MODALITY_ERROR',
    });
  });

  it('asks the local store with a study-level QIDO and needs the exact UID back', async () => {
    const get = jest.fn(async () => ({ data: [{ '0020000D': { Value: [UID] } }] }));
    expect(await isStudyInLocalStore(UID, get)).toBe(true);
    expect(get).toHaveBeenCalledWith('/proxy/orthanc/dicom-web/studies', {
      headers: { Accept: 'application/dicom+json' },
      params: { StudyInstanceUID: UID, limit: '2' },
      timeout: 10_000,
    });
    expect(await isStudyInLocalStore(UID, async () => ({ data: [] }))).toBe(false);
    expect(
      await isStudyInLocalStore(UID, async () => ({ data: [{ '0020000D': { Value: ['9.9'] } }] }))
    ).toBe(false);
  });
});
