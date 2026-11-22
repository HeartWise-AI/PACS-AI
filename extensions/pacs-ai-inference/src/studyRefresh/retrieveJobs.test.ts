import { pollRetrieveJobs, RetrieveJobsError, summarizeRetrieveJobs } from './retrieveJobs';

const noWait = () => Promise.resolve();

describe('summarizeRetrieveJobs', () => {
  it('computes the work list progress from the completed jobs', () => {
    const summary = summarizeRetrieveJobs([
      { progress: 100, state: 'Success' },
      { progress: 40, state: 'Running' },
      { progress: 0, state: 'Pending' },
    ]);

    expect(summary).toEqual({
      total: 3,
      completed: 1,
      overallProgress: 33,
      averageProgress: 46,
      failed: false,
      done: false,
    });
  });

  it('is done only when every job is complete and reports a failed job', () => {
    expect(summarizeRetrieveJobs([{ progress: 100 }, { progress: 100 }]).done).toBe(true);
    expect(summarizeRetrieveJobs([]).done).toBe(false);
    expect(summarizeRetrieveJobs([]).overallProgress).toBe(0);
    expect(
      summarizeRetrieveJobs([{ progress: 100 }, { progress: 12, state: 'Failure' }]).failed
    ).toBe(true);
  });
});

describe('pollRetrieveJobs', () => {
  it('polls until every job is complete and reports the progress', async () => {
    const loadJobs = jest
      .fn()
      .mockResolvedValueOnce([{ progress: 10 }, { progress: 30 }])
      .mockResolvedValueOnce([{ progress: 100 }, { progress: 60 }])
      .mockResolvedValueOnce([{ progress: 100 }, { progress: 100 }]);
    const progress: number[] = [];

    await expect(
      pollRetrieveJobs({
        jobIds: ['a', 'b'],
        loadJobs,
        onProgress: summary => progress.push(summary.averageProgress),
        wait: noWait,
      })
    ).resolves.toBe(true);

    expect(loadJobs).toHaveBeenCalledTimes(3);
    expect(loadJobs).toHaveBeenCalledWith(['a', 'b']);
    expect(progress).toEqual([20, 80, 100]);
  });

  it('has nothing to wait for without jobs', async () => {
    const loadJobs = jest.fn();
    await expect(pollRetrieveJobs({ jobIds: [], loadJobs, wait: noWait })).resolves.toBe(true);
    expect(loadJobs).not.toHaveBeenCalled();
  });

  it('rejects when a job fails', async () => {
    const loadJobs = jest
      .fn()
      .mockResolvedValueOnce([{ progress: 50, state: 'Running' }])
      .mockResolvedValueOnce([{ progress: 50, state: 'Failure' }]);

    await expect(pollRetrieveJobs({ jobIds: ['a'], loadJobs, wait: noWait })).rejects.toMatchObject(
      { name: 'RetrieveJobsError', reason: 'failed' }
    );
    expect(loadJobs).toHaveBeenCalledTimes(2);
  });

  it('gives up when the jobs take too long', async () => {
    let time = 0;
    const loadJobs = jest.fn().mockResolvedValue([{ progress: 50, state: 'Running' }]);

    const error = await pollRetrieveJobs({
      jobIds: ['a'],
      loadJobs,
      timeoutMs: 3_000,
      intervalMs: 1_000,
      wait: async ms => {
        time += ms;
      },
      now: () => time,
    }).catch(caught => caught);

    expect(error).toBeInstanceOf(RetrieveJobsError);
    expect(error.reason).toBe('timedOut');
    expect(loadJobs).toHaveBeenCalledTimes(4);
  });

  it('tolerates a failed status request but not three in a row', async () => {
    const recovering = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([{ progress: 100 }]);
    await expect(
      pollRetrieveJobs({ jobIds: ['a'], loadJobs: recovering, wait: noWait })
    ).resolves.toBe(true);

    const down = jest.fn().mockRejectedValue(new Error('network'));
    await expect(
      pollRetrieveJobs({ jobIds: ['a'], loadJobs: down, wait: noWait })
    ).rejects.toMatchObject({ reason: 'unavailable' });
    expect(down).toHaveBeenCalledTimes(3);
  });

  it('stops quietly once cancelled', async () => {
    let cancelled = false;
    const loadJobs = jest.fn().mockImplementation(async () => {
      cancelled = true;
      return [{ progress: 10 }];
    });
    const onProgress = jest.fn();

    await expect(
      pollRetrieveJobs({
        jobIds: ['a'],
        loadJobs,
        onProgress,
        isCancelled: () => cancelled,
        wait: noWait,
      })
    ).resolves.toBe(false);
    expect(loadJobs).toHaveBeenCalledTimes(1);
    expect(onProgress).not.toHaveBeenCalled();
  });
});
