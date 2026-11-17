import {
  createStudyProcessingRESTRepository,
  MAX_STUDY_PROCESSING_PAGE_SIZE,
  StudyProcessingRESTError,
  type StudyProcessingHTTPClient,
} from './restRepository';
import type {
  ProcessingRunCountsDTO,
  ProcessingRunDetailDTO,
  WorklistStudyStatusDTO,
} from './restDTO';

const counts: ProcessingRunCountsDTO = {
  expectedModels: 0,
  pendingModels: 0,
  queuedModels: 0,
  runningModels: 0,
  completedModels: 0,
  failedModels: 0,
  skippedModels: 0,
  cancelledModels: 0,
  activeModels: 0,
};

function worklistStatus(studyInstanceUID: string): WorklistStudyStatusDTO {
  return {
    ...counts,
    studyInstanceUID,
    ingestionStatus: 'STABLE',
    retrievalState: null,
    retrievalError: null,
    runId: null,
    runNumber: null,
    trigger: null,
    phase: null,
    outcome: null,
    attentionRequired: false,
    attentionReasons: [],
    version: null,
    startedAt: null,
    completedAt: null,
    updatedAt: '2026-08-06T14:00:00Z',
  };
}

function processingRun(runId: string): ProcessingRunDetailDTO {
  return {
    ...counts,
    runId,
    studyInstanceUID: '1.2.3',
    runNumber: 1,
    trigger: 'AUTO',
    phase: 'TERMINAL',
    outcome: 'SUCCESS',
    attentionRequired: false,
    attentionReasons: [],
    version: 1,
    startedAt: '2026-08-06T13:00:00Z',
    completedAt: '2026-08-06T13:01:00Z',
    createdAt: '2026-08-06T13:00:00Z',
    updatedAt: '2026-08-06T13:01:00Z',
    executions: [],
  };
}

function createClient() {
  const get = jest.fn();
  const post = jest.fn();
  return {
    get,
    post,
    client: { get, post } as unknown as StudyProcessingHTTPClient,
  };
}

describe('study processing REST repository', () => {
  test('requests only visible studies as repeated query parameters without a tenant ID', async () => {
    const { client, get } = createClient();
    get.mockResolvedValue({
      data: {
        success: true,
        message: 'ok',
        data: {
          studies: [worklistStatus('1.2.3')],
          limit: 25,
          offset: 0,
          hasMore: false,
        },
      },
    });
    const repository = createStudyProcessingRESTRepository(client);

    const result = await repository.loadWorklistStudyStatuses({
      studyInstanceUIDs: ['1.2.3', '4.5.6', '1.2.3'],
    });

    expect(result.summaries[0].studyInstanceUID).toBe('1.2.3');
    expect(get).toHaveBeenCalledTimes(1);
    const [path, config] = get.mock.calls[0];
    expect(path).toBe('/v1/inference/worklist/status');
    expect(config.params.getAll('studyInstanceUID')).toEqual(['1.2.3', '4.5.6']);
    expect(config.params.get('limit')).toBe('25');
    expect(config.params.get('offset')).toBe('0');
    expect(config.params.has('tenantId')).toBe(false);
  });

  test('prevents an empty visible-study request from becoming a full-tenant request', async () => {
    const { client, get } = createClient();
    const repository = createStudyProcessingRESTRepository(client);

    await expect(
      repository.loadWorklistStudyStatuses({ studyInstanceUIDs: [] })
    ).rejects.toMatchObject({ status: 400 });
    expect(get).not.toHaveBeenCalled();
  });

  test('loads and maps run history from the study-scoped endpoint', async () => {
    const { client, get } = createClient();
    get.mockResolvedValue({
      data: {
        success: true,
        message: 'ok',
        data: {
          runs: [processingRun('run-1')],
          limit: 10,
          offset: 20,
          hasMore: true,
        },
      },
    });
    const repository = createStudyProcessingRESTRepository(client);

    const result = await repository.loadStudyProcessingRunHistory({
      studyInstanceUID: '1.2.3',
      limit: 10,
      offset: 20,
    });

    expect(result.history.runs[0].id).toBe('run-1');
    expect(result).toMatchObject({ limit: 10, offset: 20, hasMore: true });
    expect(get).toHaveBeenCalledWith(
      '/v1/inference/worklist/studies/1.2.3/runs',
      expect.objectContaining({ params: expect.any(URLSearchParams) })
    );
  });

  test('loads one exact run only when explicitly requested', async () => {
    const { client, get } = createClient();
    get.mockResolvedValue({
      data: {
        success: true,
        message: 'ok',
        data: processingRun('run/with separator'),
      },
    });
    const repository = createStudyProcessingRESTRepository(client);

    const result = await repository.loadProcessingRunDetail('run/with separator');

    expect(result.id).toBe('run/with separator');
    expect(get).toHaveBeenCalledWith(
      '/v1/inference/processing/runs/run%2Fwith%20separator',
      undefined
    );
  });

  test('creates one manual study run using only the encoded Study Instance UID', async () => {
    const { client, post } = createClient();
    post.mockResolvedValue({
      data: {
        success: true,
        message: 'created',
        data: {
          runId: 'run-2',
          runNumber: 2,
          trigger: 'MANUAL_REPROCESS',
          phase: 'QUEUED',
          expectedModels: 3,
        },
      },
    });
    const repository = createStudyProcessingRESTRepository(client);

    await expect(repository.reprocessStudy('1.2/3')).resolves.toEqual({
      id: 'run-2',
      runNumber: 2,
      trigger: 'MANUAL_REPROCESS',
      phase: 'QUEUED',
      expectedModels: 3,
    });
    expect(post).toHaveBeenCalledWith('/v1/inference/worklist/studies/1.2%2F3/reprocess');
    expect(post.mock.calls[0][0]).not.toContain('tenant');
  });

  test('rejects unbounded pagination before sending a request', async () => {
    const { client, get } = createClient();
    const repository = createStudyProcessingRESTRepository(client);

    await expect(
      repository.loadWorklistStudyStatuses({
        studyInstanceUIDs: ['1.2.3'],
        limit: MAX_STUDY_PROCESSING_PAGE_SIZE + 1,
      })
    ).rejects.toBeInstanceOf(StudyProcessingRESTError);
    expect(get).not.toHaveBeenCalled();
  });

  test.each([
    [400, 'The processing status request was invalid.'],
    [401, 'Authentication is required to load processing status.'],
    [403, 'You do not have permission to view processing status.'],
    [404, 'The requested processing information was not found.'],
    [500, 'The processing status service encountered an error.'],
    [503, 'The processing status service is temporarily unavailable.'],
  ])('maps HTTP %i to a safe frontend error', async (status, message) => {
    const { client, get } = createClient();
    get.mockRejectedValue({ response: { status, data: { message: 'private backend detail' } } });
    const repository = createStudyProcessingRESTRepository(client);

    await expect(
      repository.loadWorklistStudyStatuses({ studyInstanceUIDs: ['1.2.3'] })
    ).rejects.toEqual(new StudyProcessingRESTError(message, status));
  });

  test.each([
    [400, 'The Study Instance UID is invalid.'],
    [401, 'Authentication is required to reprocess this study.'],
    [403, 'You do not have permission to reprocess this study.'],
    [404, 'No processing candidates were found for this study.'],
    [409, 'This study already has an active processing run.'],
    [500, 'The processing service could not create a new run.'],
    [503, 'The processing service is temporarily unavailable.'],
  ])('maps reprocess HTTP %i to a safe action error', async (status, message) => {
    const { client, post } = createClient();
    post.mockRejectedValue({ response: { status, data: { message: 'private backend detail' } } });
    const repository = createStudyProcessingRESTRepository(client);

    await expect(repository.reprocessStudy('1.2.3')).rejects.toMatchObject({ status, message });
  });

  describe('run cancellation', () => {
    test('posts to the run cancel endpoint and maps the returned run', async () => {
      const { client, post } = createClient();
      post.mockResolvedValue({
        data: {
          success: true,
          message: 'ok',
          data: {
            ...processingRun('run 7'),
            outcome: 'PARTIAL_SUCCESS',
            cancelledModels: 3,
            cancellable: false,
            cancelledAt: '2026-11-16T10:00:00Z',
          },
        },
      });
      const repository = createStudyProcessingRESTRepository(client);

      const run = await repository.cancelProcessingRun(' run 7 ');

      expect(post).toHaveBeenCalledTimes(1);
      // No body: the tenant and the user come from the session.
      expect(post.mock.calls[0]).toEqual(['/v1/inference/processing/runs/run%207/cancel']);
      expect(run).toMatchObject({
        id: 'run 7',
        phase: 'TERMINAL',
        outcome: 'PARTIAL_SUCCESS',
        cancelledModels: 3,
        cancellable: false,
        cancelledAt: '2026-11-16T10:00:00Z',
      });
    });

    test('rejects an empty run identifier without a request', async () => {
      const { client, post } = createClient();
      const repository = createStudyProcessingRESTRepository(client);

      await expect(repository.cancelProcessingRun('  ')).rejects.toMatchObject({ status: 400 });
      expect(post).not.toHaveBeenCalled();
    });

    test.each([
      [404, 'The analysis was not found.'],
      [409, 'The analysis is already computing and can no longer be cancelled.'],
      [503, 'The processing service is temporarily unavailable.'],
      [418, 'Unable to cancel this analysis.'],
    ])('reports status %s with a safe message', async (status, message) => {
      const { client, post } = createClient();
      post.mockRejectedValue({
        response: { status, data: { message: 'tenant-b run-9 internal detail' } },
      });
      const repository = createStudyProcessingRESTRepository(client);

      const error = await repository.cancelProcessingRun('run-9').catch(caught => caught);

      expect(error).toBeInstanceOf(StudyProcessingRESTError);
      expect(error).toMatchObject({ status, message });
      expect(error.message).not.toContain('tenant-b');
    });

    test('treats an unsuccessful envelope as a failure', async () => {
      const { client, post } = createClient();
      post.mockResolvedValue({ data: { success: false, message: 'no', data: null } });
      const repository = createStudyProcessingRESTRepository(client);

      await expect(repository.cancelProcessingRun('run-9')).rejects.toMatchObject({
        status: null,
        message: 'Unable to cancel this analysis.',
      });
    });
  });

  describe('run detail waiting fields', () => {
    async function loadDetail(extra: Record<string, unknown>) {
      const { client, get } = createClient();
      get.mockResolvedValue({
        data: { success: true, message: 'ok', data: { ...processingRun('run-1'), ...extra } },
      });
      return createStudyProcessingRESTRepository(client).loadProcessingRunDetail('run-1');
    }

    test('maps why a run waits and whether it can be cancelled', async () => {
      const run = await loadDetail({
        phase: 'QUEUED',
        outcome: null,
        cancellable: true,
        waitingReason: 'study_growing',
        stableAfter: '2026-11-16T10:20:00Z',
      });

      expect(run).toMatchObject({
        cancellable: true,
        waitingReason: 'study_growing',
        stableAfter: '2026-11-16T10:20:00Z',
      });
      expect(run).not.toHaveProperty('cancelledAt');

      expect(await loadDetail({ cancellable: false, waitingReason: 'stale' })).toMatchObject({
        cancellable: false,
        waitingReason: 'stale',
      });
    });

    test('a backend that does not send the fields maps to the run as before', async () => {
      const run = await loadDetail({});

      ['cancellable', 'cancelledAt', 'waitingReason', 'stableAfter'].forEach(field => {
        expect(run).not.toHaveProperty(field);
      });
    });

    test('ignores values it does not know', async () => {
      const run = await loadDetail({
        cancellable: 'yes',
        cancelledAt: null,
        waitingReason: 'waiting_for_godot',
        stableAfter: '2026-11-16T10:20:00Z',
      });

      ['cancellable', 'cancelledAt', 'waitingReason', 'stableAfter'].forEach(field => {
        expect(run).not.toHaveProperty(field);
      });
    });
  });
});
