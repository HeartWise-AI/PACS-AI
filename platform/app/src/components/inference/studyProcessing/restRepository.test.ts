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
  return {
    get,
    client: { get } as unknown as StudyProcessingHTTPClient,
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
    [401, 'Authentication is required to load processing status.'],
    [403, 'You do not have permission to view processing status.'],
    [503, 'The processing status service is temporarily unavailable.'],
  ])('maps HTTP %i to a safe frontend error', async (status, message) => {
    const { client, get } = createClient();
    get.mockRejectedValue({ response: { status, data: { message: 'private backend detail' } } });
    const repository = createStudyProcessingRESTRepository(client);

    await expect(
      repository.loadWorklistStudyStatuses({ studyInstanceUIDs: ['1.2.3'] })
    ).rejects.toEqual(new StudyProcessingRESTError(message, status));
  });
});
