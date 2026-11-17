import {
  createPredictionsRepository,
  exportFileName,
  mapPredictionsPage,
} from './predictionsRepository';

describe('AI predictions repository', () => {
  test('lists predictions with the given parameters and maps the page', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          view: 'all',
          limit: 25,
          offset: 0,
          total: 1,
          hasMore: false,
          canViewAll: true,
          exams: [
            {
              studyInstanceUID: '1.2.3',
              patientId: 'SYN-1',
              lastActivityAt: '2026-11-16T09:00:00Z',
              active: true,
              counts: { total: 1, running: 1 },
              models: [
                {
                  runId: 'r',
                  executionId: 'e',
                  modelName: 'PanEcho',
                  state: 'running',
                  earlierRuns: 2,
                },
                { runId: '', executionId: 'x', modelName: 'Broken' },
              ],
              launchers: [
                { kind: 'user', trigger: 'VIEWER_REQUEST', userId: 'u', name: 'Dr A', runs: 1 },
                { kind: 'x' },
              ],
            },
            { patientId: 'no uid' },
          ],
        },
      },
    });
    const page = await createPredictionsRepository({ get }).listPredictions({ view: 'all' });
    expect(get).toHaveBeenCalledWith('/v1/inference/predictions', { params: { view: 'all' } });
    expect(page.canViewAll).toBe(true);
    expect(page.exams).toHaveLength(1);
    expect(page.exams[0].models).toHaveLength(1);
    expect(page.exams[0].models[0]).toMatchObject({ state: 'running', earlierRuns: 2 });
    expect(page.exams[0].launchers).toHaveLength(1);
  });

  test('a refused view keeps the HTTP status', async () => {
    const get = jest
      .fn()
      .mockRejectedValue({ response: { status: 403, data: { errorCode: 'FORBIDDEN_ACCESS' } } });
    await expect(
      createPredictionsRepository({ get }).listPredictions({ view: 'all' })
    ).rejects.toMatchObject({
      status: 403,
      errorCode: 'FORBIDDEN_ACCESS',
    });
  });

  test('loads one model history with an encoded Study Instance UID', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        success: true,
        data: {
          executions: [{ runId: 'r', executionId: 'e', modelName: 'M', state: 'completed' }],
          hasMore: false,
        },
      },
    });
    const history = await createPredictionsRepository({ get }).loadModelHistory(
      '1.2/3',
      'DeepCORO-JEPA'
    );
    expect(get).toHaveBeenCalledWith('/v1/inference/predictions/1.2%2F3/history', {
      params: { model: 'DeepCORO-JEPA' },
    });
    expect(history.executions).toHaveLength(1);
  });

  test('exports the CSV as text with its file name and truncation flag', async () => {
    const get = jest.fn().mockResolvedValue({
      data: 'a,b\r\n',
      headers: {
        'content-disposition': 'attachment; filename="ai-predictions-20261116-093005.csv"',
        'x-export-truncated': 'true',
      },
    });
    const exported = await createPredictionsRepository({ get }).exportCSV({ view: 'mine' });
    expect(get.mock.calls[0][1]).toMatchObject({ params: { view: 'mine' }, responseType: 'text' });
    expect(exported).toEqual({
      text: 'a,b\r\n',
      fileName: 'ai-predictions-20261116-093005.csv',
      truncated: true,
    });
    expect(
      exportFileName('attachment; filename="../../x.csv"', new Date('2026-11-16T09:30:05Z'))
    ).toBe('ai-predictions-20261116-093005.csv');
  });

  test('rejects a malformed page', () => {
    expect(() => mapPredictionsPage({ exams: 'nope' })).toThrow('invalid');
  });
});
