import React from 'react';
import { TextDecoder } from 'util';
import { act, render as rtlRender, type RenderResult } from '@testing-library/react';
import { ViewerModelResultDrawer } from './ViewerModelResultDrawer';
import { ViewerResultsRequestError, type ViewerResultsRepository } from './viewerResultsRepository';
import type { ViewerModelResult } from './types';
import { echoSrResultFixtures } from '../studyProcessing/modelResults/echoSrFixtures';

Object.assign(globalThis, { TextDecoder: globalThis.TextDecoder ?? TextDecoder });

jest.mock('../studyProcessing/useModelExecutionResultViewer', () => ({
  useModelExecutionResultViewer: () => ({
    state: { key: null, selection: null, status: 'idle', result: null, failure: null },
    open: jest.fn(),
    close: jest.fn(),
    retry: jest.fn(),
  }),
}));

jest.mock('../studyProcessing/modelResults/ModelResultRenderer', () => ({
  ModelResultRenderer: ({
    result,
    measured,
    patientSex,
  }: {
    result: { modelName: string };
    measured?: { asGrading?: { grade?: string } | null } | null;
    patientSex?: string | null;
  }) => (
    <div
      data-testid="structured-result"
      data-model={result.modelName}
      data-measured-grade={measured?.asGrading?.grade ?? 'none'}
      data-sex={patientSex ?? ''}
    />
  ),
}));

jest.mock('./ViewerModelResultFeedback', () => ({ __esModule: true, default: () => null }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? key),
  }),
}));

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'echo-sr-measurements',
    modelVersion: '1.0.0',
    modality: 'echocardiogram',
    modelId: null,
    artifactModelId: null,
    containerId: null,
    runId: null,
    executionId: null,
    studyServiceJobId: 'job-sr',
    completedAt: '2026-11-10T10:00:00Z',
    trigger: null,
    selectedViews: null,
    reportAvailable: false,
    ...overrides,
  };
}

function repository(overrides: Partial<ViewerResultsRepository> = {}): ViewerResultsRepository {
  return {
    loadLatestResults: jest.fn(),
    runModel: jest.fn(),
    loadRunStatus: jest.fn(),
    loadReport: jest.fn().mockRejectedValue(new ViewerResultsRequestError('no', 404)),
    ...overrides,
  };
}

const byTestId = (renderer: RenderResult, id: string) =>
  Array.from(renderer.container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));

describe('ViewerModelResultDrawer stored job results', () => {
  let renderer: RenderResult | null = null;

  async function render(
    viewerResult: ViewerModelResult,
    repo: ViewerResultsRepository,
    measuredResult: ViewerModelResult | null = null
  ) {
    await act(async () => {
      renderer = rtlRender(
        <ViewerModelResultDrawer
          result={viewerResult}
          repository={repo}
          measuredResult={measuredResult}
          onClose={jest.fn()}
          onMinimize={jest.fn()}
          onSelectView={jest.fn(() => true)}
        />
      );
    });
  }

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  test('loads the stored JSON of a job without an api-pacs run and titles the SR card', async () => {
    const loadJobResult = jest.fn().mockResolvedValue({
      runId: '',
      executionId: '',
      studyInstanceUID: '1.2.3',
      modelName: 'echo-sr-measurements',
      modelVersion: '1.0.0',
      status: 'completed',
      completedAt: '2026-11-10T10:00:00Z',
      result: echoSrResultFixtures.severeGe,
    });
    await render(result(), repository({ loadJobResult }));

    expect(loadJobResult).toHaveBeenCalledTimes(1);
    const [structured] = byTestId(renderer!, 'structured-result');
    expect(structured.getAttribute('data-model')).toBe('echo-sr-measurements');
    expect(byTestId(renderer!, 'viewer-model-result-no-details')).toHaveLength(0);
    expect(renderer!.container.querySelector('#viewer-model-result-title')?.textContent).toContain(
      'Echo measurements (SR)'
    );
  });

  test.each([403, 404])('keeps the unavailable state when the gateway answers %s', async status => {
    const loadJobResult = jest.fn().mockRejectedValue(new ViewerResultsRequestError('no', status));
    await render(result(), repository({ loadJobResult }));

    expect(byTestId(renderer!, 'structured-result')).toHaveLength(0);
    expect(byTestId(renderer!, 'viewer-model-result-no-details')).toHaveLength(1);
  });

  test.each([[{}], [[]]])(
    'says details are unavailable for an empty stored result %j',
    async empty => {
      const loadJobResult = jest.fn().mockResolvedValue({
        runId: '',
        executionId: '',
        studyInstanceUID: '1.2.3',
        modelName: 'echo-sr-measurements',
        modelVersion: '1.0.0',
        status: 'completed',
        completedAt: '',
        result: empty,
      });
      await render(result(), repository({ loadJobResult }));

      expect(loadJobResult).toHaveBeenCalledTimes(1);
      expect(byTestId(renderer!, 'structured-result')).toHaveLength(0);
      expect(byTestId(renderer!, 'viewer-model-result-job-result')).toHaveLength(0);
      expect(byTestId(renderer!, 'viewer-model-result-no-details')).toHaveLength(1);
    }
  );

  test('shows the measured SR values first in the EchoPrime drawer', async () => {
    const loadJobResult = jest.fn().mockResolvedValue({
      runId: '',
      executionId: '',
      studyInstanceUID: '1.2.3',
      modelName: 'echo-sr-measurements',
      modelVersion: '1.0.0',
      status: 'completed',
      completedAt: '',
      result: echoSrResultFixtures.severeGe,
    });
    const html = btoa('<html><body>report</body></html>');
    await render(
      result({
        modelName: 'EchoPrime',
        modelVersion: '1.0.0',
        runId: 'run-1',
        executionId: 'ex-1',
        reportAvailable: true,
      }),
      repository({
        loadJobResult,
        loadReport: jest.fn().mockResolvedValue({ htmlBase64: html, contentType: 'text/html' }),
      }),
      result()
    );

    const [compact] = byTestId(renderer!, 'echo-sr-compact');
    expect(compact.textContent).toContain('Severe AS (measured)');
    expect(compact.textContent).toContain('4.31 m/s');
    const report = byTestId(renderer!, 'viewer-model-result-report')[0];
    // The measured block comes before the AI report.
    expect(compact.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('PanEcho: the measured SR values go into the structured report, not a block above it', async () => {
    const loadJobResult = jest.fn().mockImplementation((job: { studyServiceJobId: string }) =>
      Promise.resolve({
        runId: '',
        executionId: '',
        studyInstanceUID: '1.2.3',
        modelName: job.studyServiceJobId === 'job-sr' ? 'echo-sr-measurements' : 'PanEcho',
        modelVersion: job.studyServiceJobId === 'job-sr' ? '1.0.0' : '1.1.4',
        status: 'completed',
        completedAt: '',
        result:
          job.studyServiceJobId === 'job-sr'
            ? echoSrResultFixtures.severeGe
            : { diagnosis: '{}', predictions: { 'LV size': [0.1, 0.1, 0.8] } },
      })
    );
    const loadReport = jest.fn();
    await act(async () => {
      renderer = rtlRender(
        <ViewerModelResultDrawer
          result={result({ modelName: 'PanEcho', modelVersion: '1.1.4', studyServiceJobId: 'job-pe', reportAvailable: true })}
          repository={repository({
            loadJobResult: loadJobResult as unknown as ViewerResultsRepository['loadJobResult'],
            loadReport,
          })}
          measuredResult={result()}
          patientSex="F"
          onClose={jest.fn()}
          onMinimize={jest.fn()}
          onSelectView={jest.fn(() => true)}
        />
      );
    });

    // PanEcho is shown with its structured report even when an HTML report exists.
    expect(loadReport).not.toHaveBeenCalled();
    expect(byTestId(renderer!, 'echo-sr-compact')).toHaveLength(0);
    const [structured] = byTestId(renderer!, 'structured-result');
    expect(structured.getAttribute('data-model')).toBe('PanEcho');
    expect(structured.getAttribute('data-measured-grade')).toBe('severe');
    expect(structured.getAttribute('data-sex')).toBe('F');
  });

  test('does not show the measured block for angiogram models', async () => {
    const loadJobResult = jest.fn();
    await render(
      result({ modelName: 'DeepCORO-JEPA', runId: 'r', executionId: 'e', reportAvailable: true }),
      repository({
        loadJobResult,
        loadReport: jest
          .fn()
          .mockResolvedValue({ htmlBase64: btoa('x'), contentType: 'text/html' }),
      }),
      result()
    );

    expect(loadJobResult).not.toHaveBeenCalled();
    expect(byTestId(renderer!, 'echo-sr-compact')).toHaveLength(0);
  });

  test('shows EchoAlign with its structured template, not the HTML report, with the SR first', async () => {
    const loadReport = jest
      .fn()
      .mockResolvedValue({ htmlBase64: 'PGgxPg==', contentType: 'text/html' });
    const loadJobResult = jest.fn(async (job: ViewerModelResult) => ({
      runId: '',
      executionId: '',
      studyInstanceUID: '1.2.3',
      modelName: job.modelName,
      modelVersion: job.modelVersion,
      status: 'completed',
      completedAt: '2026-11-27T10:00:00Z',
      result:
        job.modelName === 'echo-sr-measurements'
          ? echoSrResultFixtures.severeGe
          : { predictions: {} },
    }));
    await render(
      result({
        modelName: 'EchoAlign (research use only)',
        modelVersion: '0.1.2',
        studyServiceJobId: 'job-ea',
        reportAvailable: true,
      }),
      repository({ loadReport, loadJobResult }),
      result()
    );

    expect(loadReport).not.toHaveBeenCalled();
    expect(byTestId(renderer!, 'viewer-model-result-report')).toHaveLength(0);
    const models = byTestId(renderer!, 'structured-result').map(element =>
      element.getAttribute('data-model')
    );
    expect(models).toContain('EchoAlign (research use only)');
    expect(loadJobResult).toHaveBeenCalledTimes(2);
  });
});
