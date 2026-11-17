import { createExamRetriever, ExamRetrievalError } from './examRetrieval';
import {
  SELECTED_DICOM_MODALITY_STORAGE_KEY,
  STUDY_SOURCE_MODALITY_STORAGE_KEY,
} from '@ohif/app/src/components/inference/studyRefresh/sourceModality';

const STUDY = '1.2.826.0.1.3680043.10.1';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

function repository(overrides = {}) {
  return {
    loadModalities: jest.fn(async () => ({ PACS1: { allowMove: true } })),
    retrieveStudy: jest.fn(async () => ['job-1', 'job-2']),
    loadJobs: jest
      .fn()
      .mockResolvedValueOnce([{ progress: 40 }, { progress: 60 }])
      .mockResolvedValue([{ progress: 100 }, { progress: 100 }]),
    ...overrides,
  };
}

describe('AI predictions exam retrieval', () => {
  test('resolves the PACS source once per page and retrieves with progress', async () => {
    const api = repository();
    const session = memoryStorage();
    const retriever = createExamRetriever(api, {
      wait: async () => undefined,
      sessionStorage: session,
      localStorage: memoryStorage(),
    });
    expect(await retriever.source(STUDY)).toBe('PACS1');
    expect(await retriever.source('1.2.3')).toBe('PACS1');
    expect(api.loadModalities).toHaveBeenCalledTimes(1);

    const progress: Array<number | null> = [];
    expect(await retriever.retrieve(STUDY, 'PACS1', value => progress.push(value))).toBe(true);
    expect(api.retrieveStudy).toHaveBeenCalledWith({
      modalityId: 'PACS1',
      studyInstanceUID: STUDY,
    });
    expect(progress).toEqual([50, 100]);
    // The viewer's "Refresh study from PACS" then knows where the study came from.
    expect(session.getItem(STUDY_SOURCE_MODALITY_STORAGE_KEY)).toBe(
      JSON.stringify([[STUDY, 'PACS1']])
    );
  });

  test('no source when the tenant has several PACS and none was chosen', async () => {
    const api = repository({
      loadModalities: jest.fn(async () => ({ A: {}, B: {} })),
    });
    const retriever = createExamRetriever(api, {
      sessionStorage: memoryStorage(),
      localStorage: memoryStorage(),
    });
    expect(await retriever.source(STUDY)).toBeNull();
    const chosen = createExamRetriever(api, {
      sessionStorage: memoryStorage(),
      localStorage: memoryStorage({ [SELECTED_DICOM_MODALITY_STORAGE_KEY]: 'B' }),
    });
    expect(await chosen.source(STUDY)).toBe('B');
  });

  test('a retrieval that cannot start, fails or takes too long is reported', async () => {
    const options = { wait: async () => undefined, sessionStorage: memoryStorage() };
    const notStarted = createExamRetriever(
      repository({ retrieveStudy: jest.fn().mockRejectedValue({ errorCode: 'X' }) }),
      options
    );
    await expect(notStarted.retrieve(STUDY, 'PACS1', () => undefined)).rejects.toMatchObject({
      reason: 'startFailed',
    });

    const failed = createExamRetriever(
      repository({ loadJobs: jest.fn(async () => [{ progress: 10, state: 'Failure' }]) }),
      options
    );
    const failure = await failed.retrieve(STUDY, 'PACS1', () => undefined).catch(error => error);
    expect(failure).toBeInstanceOf(ExamRetrievalError);
    expect(failure.reason).toBe('failed');

    let clock = 0;
    const slow = createExamRetriever(
      repository({ loadJobs: jest.fn(async () => [{ progress: 10 }]) }),
      {
        ...options,
        timeoutMs: 1000,
        wait: async () => {
          clock += 600;
        },
      }
    );
    const originalNow = Date.now;
    Date.now = () => clock;
    try {
      await expect(slow.retrieve(STUDY, 'PACS1', () => undefined)).rejects.toMatchObject({
        reason: 'timedOut',
      });
    } finally {
      Date.now = originalNow;
    }
  });
});
