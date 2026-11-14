import React from 'react';
import { TextDecoder } from 'util';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { ViewerModelResultDrawer } from './ViewerModelResultDrawer';
import { ViewerResultsRequestError, type ViewerResultsRepository } from './viewerResultsRepository';
import type { ViewerModelResult } from './types';

// jsdom does not provide TextDecoder, which the report decoder uses.
Object.assign(globalThis, { TextDecoder: globalThis.TextDecoder ?? TextDecoder });

const mockOpen = jest.fn();
const mockViewerState = {
  key: null,
  selection: null,
  status: 'idle',
  result: null,
  failure: null,
};

jest.mock('../studyProcessing/useModelExecutionResultViewer', () => ({
  useModelExecutionResultViewer: () => ({
    state: mockViewerState,
    open: mockOpen,
    close: jest.fn(),
    retry: jest.fn(),
  }),
}));

jest.mock('../studyProcessing/modelResults/ModelResultRenderer', () => ({
  ModelResultRenderer: () => <div data-testid="structured-result" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? key),
  }),
}));

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '1.3.0',
    modality: 'angiogram',
    modelId: 'model-1',
    containerId: null,
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: null,
    completedAt: '2026-11-10T10:00:00Z',
    trigger: 'VIEWER_REQUEST',
    selectedViews: [
      {
        sopInstanceUID: 'sop-1',
        seriesInstanceUID: 'series-1',
        viewLabel: 'LAO cranial',
        order: 0,
        role: 'diagnostic',
        extra: null,
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
    ...overrides,
  };
}

function repository(loadReport: ViewerResultsRepository['loadReport']): ViewerResultsRepository {
  return { loadLatestResults: jest.fn(), runModel: jest.fn(), loadReport };
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON());

describe('ViewerModelResultDrawer', () => {
  let renderer: ReactTestRenderer | null = null;
  const onSelectView = jest.fn(() => true);

  async function render(viewerResult: ViewerModelResult, repo: ViewerResultsRepository) {
    await act(async () => {
      renderer = TestRenderer.create(
        <ViewerModelResultDrawer
          result={viewerResult}
          repository={repo}
          onClose={jest.fn()}
          onMinimize={jest.fn()}
          onSelectView={onSelectView}
        />,
        { createNodeMock: () => ({ focus: jest.fn() }) }
      );
    });
  }

  beforeEach(() => {
    mockOpen.mockReset();
    onSelectView.mockClear();
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = null;
  });

  test('shows the stored HTML report in the sandboxed iframe', async () => {
    const loadReport = jest.fn().mockResolvedValue({
      htmlBase64: btoa('<h1>Report</h1>'),
      contentType: 'text/html',
    });
    await render(result(), repository(loadReport));

    const iframe = renderer!.root.findByProps({ 'data-testid': 'viewer-model-result-report' });
    expect(iframe.props.srcDoc).toBe('<h1>Report</h1>');
    expect(iframe.props.sandbox).toBe('allow-same-origin allow-scripts');
    expect(mockOpen).not.toHaveBeenCalled();
    expect(text(renderer!)).toContain('Run from viewer');
    expect(text(renderer!)).toContain('1.3.0');
  });

  test('lists selected views, labels unknown ones and loads a clip on click', async () => {
    await render(result(), repository(jest.fn().mockResolvedValue({ htmlBase64: btoa('x') })));

    const items = renderer!.root.findAllByProps({
      'data-testid': 'viewer-model-result-selected-view',
    });
    expect(items).toHaveLength(2);
    expect(text(renderer!)).toContain('LAO cranial');
    expect(text(renderer!)).toContain('Unknown view');

    act(() => items[1].props.onClick());
    expect(onSelectView).toHaveBeenCalledWith(result().selectedViews![1]);
  });

  test('says when the run did not record its views', async () => {
    await render(
      result({ selectedViews: null }),
      repository(jest.fn().mockResolvedValue({ htmlBase64: btoa('x') }))
    );

    expect(text(renderer!)).toContain('Views not recorded for this run');
  });

  test('uses the structured result renderer when the model cannot render a report', async () => {
    const loadReport = jest.fn();
    await render(result({ reportAvailable: false }), repository(loadReport));

    expect(loadReport).not.toHaveBeenCalled();
    expect(mockOpen).toHaveBeenCalledWith({
      studyInstanceUID: '1.2.3',
      runId: 'run-1',
      executionId: 'execution-1',
      modelName: 'DeepCORO-JEPA',
      modelVersion: '1.3.0',
      status: 'completed',
    });
  });

  test('falls back to the structured result when the report request fails', async () => {
    const loadReport = jest
      .fn()
      .mockRejectedValue(new ViewerResultsRequestError('x', 404, 'REPORT_NOT_AVAILABLE'));
    await render(result(), repository(loadReport));

    expect(loadReport).toHaveBeenCalled();
    expect(mockOpen).toHaveBeenCalled();
  });

  test('explains when a legacy row has neither a report nor execution ids', async () => {
    await render(
      result({
        reportAvailable: false,
        runId: null,
        executionId: null,
        studyServiceJobId: 'job-1',
      }),
      repository(jest.fn())
    );

    expect(
      renderer!.root.findByProps({ 'data-testid': 'viewer-model-result-no-details' })
    ).toBeTruthy();
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
