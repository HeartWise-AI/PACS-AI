import {
  createRESTStudyReprocessTransport,
  createStudyReprocessRequestCoordinator,
  type StudyReprocessTransport,
} from './reprocessTransport';
import { StudyReprocessRESTError } from './restRepository';
import type { CreatedStudyProcessingRun } from './types';

const createdRun: CreatedStudyProcessingRun = {
  id: 'run-2',
  runNumber: 2,
  trigger: 'MANUAL_REPROCESS',
  phase: 'QUEUED',
  expectedModels: 3,
};

describe('study reprocess transport', () => {
  it('adapts the REST repository without adding request fields', async () => {
    const reprocessStudy = jest.fn().mockResolvedValue(createdRun);
    const transport = createRESTStudyReprocessTransport({ reprocessStudy } as never);

    await expect(transport.reprocessStudy('1.2.3')).resolves.toBe(createdRun);
    expect(reprocessStudy).toHaveBeenCalledWith('1.2.3');
  });

  it('converts REST failures into a transport-independent action error', async () => {
    const transport = createRESTStudyReprocessTransport({
      reprocessStudy: jest.fn().mockRejectedValue(new StudyReprocessRESTError('Active run.', 409)),
    } as never);

    await expect(transport.reprocessStudy('1.2.3')).rejects.toMatchObject({
      name: 'StudyReprocessError',
      message: 'Active run.',
      status: 409,
    });
  });

  it('returns one shared in-flight request for repeated submissions of the same study', async () => {
    let resolveRequest: (run: CreatedStudyProcessingRun) => void;
    const request = new Promise<CreatedStudyProcessingRun>(resolve => {
      resolveRequest = resolve;
    });
    const reprocessStudy = jest.fn().mockReturnValue(request);
    const coordinator = createStudyReprocessRequestCoordinator({
      reprocessStudy,
    });

    const first = coordinator.submit('1.2.3');
    const second = coordinator.submit('1.2.3');

    expect(second).toBe(first);
    expect(coordinator.isPending('1.2.3')).toBe(true);
    expect(reprocessStudy).toHaveBeenCalledTimes(1);

    resolveRequest!(createdRun);
    await first;
    expect(coordinator.isPending('1.2.3')).toBe(false);
  });

  it('allows independent studies and a later retry after failure', async () => {
    const reprocessStudy = jest
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue(createdRun);
    const transport: StudyReprocessTransport = { reprocessStudy };
    const coordinator = createStudyReprocessRequestCoordinator(transport);

    await expect(coordinator.submit('study-a')).rejects.toThrow('unavailable');
    await expect(coordinator.submit('study-a')).resolves.toBe(createdRun);
    expect(reprocessStudy).toHaveBeenCalledTimes(2);
  });

  it('clears pending ownership for an authentication lifecycle change', () => {
    const coordinator = createStudyReprocessRequestCoordinator({
      reprocessStudy: jest.fn().mockReturnValue(new Promise(() => undefined)),
    });

    void coordinator.submit('1.2.3');
    coordinator.clear();

    expect(coordinator.isPending('1.2.3')).toBe(false);
  });
});
