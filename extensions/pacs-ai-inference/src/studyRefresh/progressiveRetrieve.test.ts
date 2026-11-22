import {
  firstSeriesJobIds,
  followPendingRetrieve,
  isReadyToOpen,
  PENDING_RETRIEVE_MAX_AGE_MS,
  rememberPendingRetrieve,
  takePendingRetrieve,
} from './progressiveRetrieve';

const noWait = () => Promise.resolve();

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('firstSeriesJobIds', () => {
  it('picks the job of the first series', () => {
    expect(
      firstSeriesJobIds([
        { id: 'b', order: 1 },
        { id: 'a', order: 0 },
        { id: 'c', order: 2 },
      ])
    ).toEqual(['a']);
  });

  it('waits for every job when the server does not give the order', () => {
    expect(firstSeriesJobIds([{ id: 'a' }, { id: 'b' }])).toEqual(['a', 'b']);
    expect(firstSeriesJobIds([{ id: 'a', order: 0 }, { id: 'b' }])).toEqual(['a', 'b']);
  });
});

describe('isReadyToOpen', () => {
  it('is ready once the first series succeeded, whatever the others do', () => {
    expect(
      isReadyToOpen(
        [
          { id: 'a', progress: 100, state: 'Success' },
          { id: 'b', progress: 0, state: 'Pending' },
        ],
        ['a']
      )
    ).toBe(true);
  });

  it('is not ready while the first series is pending or retrying', () => {
    expect(isReadyToOpen([{ id: 'a', progress: 0, state: 'Pending' }], ['a'])).toBe(false);
    expect(isReadyToOpen([{ id: 'a', progress: 100, state: 'Failure' }], ['a'])).toBe(false);
    expect(isReadyToOpen([], ['a'])).toBe(false);
    expect(isReadyToOpen([{ id: 'a', progress: 100, state: 'Success' }], [])).toBe(false);
  });
});

describe('pending retrieve hand-over', () => {
  it('hands the remaining jobs to the viewer once', () => {
    const storage = memoryStorage();
    rememberPendingRetrieve('1.2.3', ['b', 'c'], { storage, now: () => 1000 });
    expect(takePendingRetrieve('1.2.3', { storage, now: () => 2000 })).toEqual(['b', 'c']);
    expect(takePendingRetrieve('1.2.3', { storage, now: () => 2000 })).toEqual([]);
  });

  it('ignores an old hand-over and other studies', () => {
    const storage = memoryStorage();
    rememberPendingRetrieve('1.2.3', ['b'], { storage, now: () => 0 });
    expect(takePendingRetrieve('9.9.9', { storage, now: () => 1 })).toEqual([]);
    expect(
      takePendingRetrieve('1.2.3', { storage, now: () => PENDING_RETRIEVE_MAX_AGE_MS + 1 })
    ).toEqual([]);
  });
});

describe('followPendingRetrieve', () => {
  it('reloads the series as more jobs complete, and once at the end', async () => {
    const rounds = [
      [
        { id: 'b', progress: 0, state: 'Pending' },
        { id: 'c', progress: 0, state: 'Pending' },
      ],
      [
        { id: 'b', progress: 100, state: 'Success' },
        { id: 'c', progress: 0, state: 'Pending' },
      ],
      [
        { id: 'b', progress: 100, state: 'Success' },
        { id: 'c', progress: 100, state: 'Success' },
      ],
    ];
    let round = 0;
    let clock = 0;
    const reload = jest.fn(() => Promise.resolve());

    const outcome = await followPendingRetrieve({
      jobIds: ['b', 'c'],
      loadJobs: () => Promise.resolve(rounds[Math.min(round++, rounds.length - 1)]),
      reload,
      wait: () => {
        clock += 5000;
        return Promise.resolve();
      },
      now: () => clock,
    });

    expect(outcome).toBe('done');
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('still reloads what arrived when a series fails', async () => {
    const reload = jest.fn(() => Promise.resolve());
    const outcome = await followPendingRetrieve({
      jobIds: ['b'],
      loadJobs: () => Promise.resolve([{ id: 'b', progress: 100, state: 'Failure' }]),
      reload,
      wait: noWait,
    });
    expect(outcome).toBe('failed');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stops quietly when the viewer closes the study', async () => {
    const reload = jest.fn(() => Promise.resolve());
    const outcome = await followPendingRetrieve({
      jobIds: ['b'],
      loadJobs: () => Promise.resolve([{ id: 'b', progress: 0, state: 'Pending' }]),
      reload,
      isCancelled: () => true,
      wait: noWait,
    });
    expect(outcome).toBe('cancelled');
    expect(reload).not.toHaveBeenCalled();
  });

  it('gives up after the timeout but shows what arrived', async () => {
    let clock = 0;
    const reload = jest.fn(() => Promise.resolve());
    const outcome = await followPendingRetrieve({
      jobIds: ['b'],
      loadJobs: () => Promise.resolve([{ id: 'b', progress: 0, state: 'Pending' }]),
      reload,
      timeoutMs: 10_000,
      wait: () => {
        clock += 4000;
        return Promise.resolve();
      },
      now: () => clock,
    });
    expect(outcome).toBe('timedOut');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
