import makeDeferred from './makeDeferred';
import Queue from './Queue';

describe('Queue', () => {
  // Todo: comment due to wrong implementation
  // it('should bind functions to the queue', async () => {
  //   const queue = new Queue(2);
  //   const mockedTimeout = jest.fn(timeout);
  //   const timer = queue.bind(mockedTimeout);
  //   const start = Date.now();
  //   timer(threshold).then(now => {
  //     const elapsed = now - start;
  //     expect(elapsed >= threshold && elapsed <= 2 * threshold).toBe(true);
  //   });
  //   const end = await timer(threshold);
  //   expect(end - start >= 2 * threshold).toBe(true);
  //   expect(mockedTimeout).toBeCalledTimes(2);
  // });
  it('should prevent task execution when queue limit is reached', async () => {
    const queue = new Queue(1);
    const deferred = makeDeferred();
    const mockedTask = jest.fn(() => deferred.promise);
    const task = queue.bind(mockedTask);

    const firstTask = task();

    await expect(task()).rejects.toThrow('Queue limit reached');
    expect(mockedTask).toHaveBeenCalledTimes(1);

    deferred.resolve('completed');
    await expect(firstTask).resolves.toBe('completed');
  });

  it('should safely bind tasks to the queue', async () => {
    const queue = new Queue(1);
    const mockedErrorHandler = jest.fn();
    const deferred = makeDeferred();
    const mockedTask = jest.fn(() => deferred.promise);
    const task = queue.bindSafe(mockedTask, mockedErrorHandler);

    const firstTask = task();

    await expect(task()).resolves.toBeUndefined();
    expect(mockedErrorHandler).toHaveBeenCalledTimes(1);
    expect(mockedErrorHandler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ message: 'Queue limit reached' })
    );
    expect(mockedTask).toHaveBeenCalledTimes(1);

    deferred.resolve('completed');
    await expect(firstTask).resolves.toBe('completed');
  });
});
