import {
  createViewerResultsRepository,
  isViewerResultsEndpointMissing,
  mapSelectedViews,
  ViewerResultsRequestError,
  type ViewerResultsHTTPClient,
} from './viewerResultsRepository';
import type { ViewerModelResult } from './types';

function client(overrides: Partial<ViewerResultsHTTPClient> = {}) {
  return {
    get: jest.fn(),
    post: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<ViewerResultsHTTPClient>;
}

function httpError(status: number, errorCode?: string) {
  return { response: { status, data: errorCode ? { errorCode } : {} } };
}

const latestRow = {
  modelName: 'DeepCORO-JEPA',
  modelVersion: '1.3.0',
  modality: 'angiogram',
  modelId: 'model-1',
  containerId: 'container-1',
  runId: 'run-1',
  executionId: 'execution-1',
  studyServiceJobId: 'job-1',
  completedAt: '2026-11-12T10:00:00Z',
  trigger: 'AUTO',
  selectedViews: [
    { sopInstanceUID: 'sop-2', seriesInstanceUID: null, viewLabel: null, order: 1 },
    {
      sopInstanceUID: 'sop-1',
      seriesInstanceUID: 'series-1',
      viewLabel: 'LAO cranial',
      order: 0,
      role: 'diagnostic',
      extra: { dominance: 'right' },
    },
  ],
  reportAvailable: true,
};

describe('viewer results repository', () => {
  test('loads and normalizes the latest results of a study (bare payload)', async () => {
    const http = client();
    http.get.mockResolvedValue({ data: { studyInstanceUID: '1.2.3', results: [latestRow] } });

    const results = await createViewerResultsRepository(http).loadLatestResults(' 1.2.3 ');

    expect(http.get).toHaveBeenCalledWith('/v1/inference/worklist/studies/1.2.3/latest-results');
    expect(results).toEqual([
      {
        studyInstanceUID: '1.2.3',
        modelName: 'DeepCORO-JEPA',
        modelVersion: '1.3.0',
        modality: 'angiogram',
        modelId: 'model-1',
        containerId: 'container-1',
        runId: 'run-1',
        executionId: 'execution-1',
        studyServiceJobId: 'job-1',
        completedAt: '2026-11-12T10:00:00Z',
        trigger: 'AUTO',
        selectedViews: [
          {
            sopInstanceUID: 'sop-1',
            seriesInstanceUID: 'series-1',
            viewLabel: 'LAO cranial',
            order: 0,
            role: 'diagnostic',
            extra: { dominance: 'right' },
          },
          {
            sopInstanceUID: 'sop-2',
            seriesInstanceUID: null,
            viewLabel: null,
            order: 1,
            role: null,
            extra: null,
          },
        ],
        reportAvailable: true,
      },
    ]);
  });

  test('accepts the api-pacs envelope and tolerates missing optional fields', async () => {
    const http = client();
    http.get.mockResolvedValue({
      data: {
        success: true,
        message: 'ok',
        data: { results: [{ modelName: 'EchoPrime' }, { modelVersion: 'no name' }] },
      },
    });

    const [result, ...rest] = await createViewerResultsRepository(http).loadLatestResults('1.2.3');

    expect(rest).toEqual([]);
    expect(result).toMatchObject({
      modelName: 'EchoPrime',
      modelId: null,
      runId: null,
      selectedViews: null,
      reportAvailable: false,
    });
  });

  test('keeps a recorded empty selection distinct from an unrecorded one', () => {
    expect(mapSelectedViews([])).toEqual([]);
    expect(mapSelectedViews(null)).toBeNull();
    expect(mapSelectedViews(undefined)).toBeNull();
  });

  test.each([404, 501])(
    'reports a missing endpoint (%s) so callers keep the old behaviour',
    async status => {
      const http = client();
      http.get.mockRejectedValue(httpError(status));

      const request = createViewerResultsRepository(http).loadLatestResults('1.2.3');

      await expect(request).rejects.toBeInstanceOf(ViewerResultsRequestError);
      expect(isViewerResultsEndpointMissing(await request.catch(error => error))).toBe(true);
    }
  );

  test('does not treat other failures as a missing endpoint', async () => {
    const http = client();
    http.get.mockRejectedValue(httpError(503));

    const error = await createViewerResultsRepository(http)
      .loadLatestResults('1.2.3')
      .catch(caught => caught);

    expect(error.status).toBe(503);
    expect(isViewerResultsEndpointMissing(error)).toBe(false);
  });

  test('loads the report by run and execution, or by study-service job for legacy rows', async () => {
    const http = client();
    http.get.mockResolvedValue({
      data: { htmlBase64: 'PGgxPkhpPC9oMT4=', contentType: 'text/html' },
    });
    const repository = createViewerResultsRepository(http);
    const result = {
      studyInstanceUID: '1.2.3',
      runId: 'run/1',
      executionId: 'execution-1',
      studyServiceJobId: 'job-1',
    } as ViewerModelResult;

    await expect(repository.loadReport(result)).resolves.toEqual({
      htmlBase64: 'PGgxPkhpPC9oMT4=',
      contentType: 'text/html',
    });
    await repository.loadReport({ ...result, runId: null, executionId: null });

    expect(http.get).toHaveBeenNthCalledWith(
      1,
      '/v1/inference/processing/runs/run%2F1/executions/execution-1/report'
    );
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/v1/inference/worklist/studies/1.2.3/jobs/job-1/report'
    );
  });

  test('surfaces REPORT_NOT_AVAILABLE', async () => {
    const http = client();
    http.get.mockRejectedValue(httpError(404, 'REPORT_NOT_AVAILABLE'));

    const error = await createViewerResultsRepository(http)
      .loadReport({ studyInstanceUID: '1', runId: 'r', executionId: 'e' } as ViewerModelResult)
      .catch(caught => caught);

    expect(error).toMatchObject({ status: 404, errorCode: 'REPORT_NOT_AVAILABLE' });
  });

  test('starts a managed run with the selected series', async () => {
    const http = client();
    http.post.mockResolvedValue({
      data: {
        success: true,
        message: 'created',
        data: {
          runId: 'run-2',
          runNumber: 3,
          trigger: 'VIEWER_REQUEST',
          executionId: 'execution-2',
          modelName: 'DeepCORO-JEPA',
          modelVersion: '1.3.0',
        },
      },
    });

    const run = await createViewerResultsRepository(http).runModel({
      studyInstanceUID: '1.2.3',
      modelId: 'model-1',
      seriesInstanceUIDs: ['series-1'],
    });

    expect(http.post).toHaveBeenCalledWith(
      '/v1/inference/worklist/studies/1.2.3/models/model-1/run',
      { seriesInstanceUIDs: ['series-1'] }
    );
    expect(run).toEqual({
      runId: 'run-2',
      runNumber: 3,
      trigger: 'VIEWER_REQUEST',
      executionId: 'execution-2',
      modelName: 'DeepCORO-JEPA',
      modelVersion: '1.3.0',
    });
  });

  test('keeps RUN_ALREADY_ACTIVE on run conflicts', async () => {
    const http = client();
    http.post.mockRejectedValue(httpError(409, 'RUN_ALREADY_ACTIVE'));

    const error = await createViewerResultsRepository(http)
      .runModel({ studyInstanceUID: '1.2.3', modelId: 'model-1' })
      .catch(caught => caught);

    expect(error).toMatchObject({ status: 409, errorCode: 'RUN_ALREADY_ACTIVE' });
    expect(http.post).toHaveBeenCalledWith(
      '/v1/inference/worklist/studies/1.2.3/models/model-1/run',
      {}
    );
  });
});
