import React from 'react';
import { TextDecoder } from 'util';
import { act, fireEvent, render as rtlRender, type RenderResult } from '@testing-library/react';
import { ViewerModelResultDrawer } from './ViewerModelResultDrawer';
import { ViewerResultsRequestError, type ViewerResultsRepository } from './viewerResultsRepository';
import type { ResultSeriesScope, ViewerModelResult } from './types';

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
    artifactModelId: null,
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
  return {
    loadLatestResults: jest.fn(),
    runModel: jest.fn(),
    loadRunStatus: jest.fn(),
    loadReport,
  };
}

const text = (renderer: RenderResult) => renderer.container.innerHTML;
const byTestId = (renderer: RenderResult, id: string) =>
  Array.from(renderer.container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
// Exactly one matching element.
const oneByTestId = (renderer: RenderResult, id: string) => {
  const found = byTestId(renderer, id);
  expect(found).toHaveLength(1);
  return found[0];
};

describe('ViewerModelResultDrawer', () => {
  let renderer: RenderResult | null = null;
  const onSelectView = jest.fn(() => true);

  async function render(
    viewerResult: ViewerModelResult,
    repo: ViewerResultsRepository,
    seriesScope?: ResultSeriesScope | null
  ) {
    await act(async () => {
      renderer = rtlRender(
        <ViewerModelResultDrawer
          result={viewerResult}
          seriesScope={seriesScope}
          repository={repo}
          onClose={jest.fn()}
          onMinimize={jest.fn()}
          onSelectView={onSelectView}
        />
      );
    });
  }

  beforeEach(() => {
    mockOpen.mockReset();
    onSelectView.mockClear();
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  test('shows the stored HTML report in the sandboxed iframe', async () => {
    const loadReport = jest.fn().mockResolvedValue({
      htmlBase64: btoa('<h1>Report</h1>'),
      contentType: 'text/html',
    });
    await render(result(), repository(loadReport));

    const iframe = oneByTestId(renderer!, 'viewer-model-result-report');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('srcdoc')).toBe('<h1>Report</h1>');
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin allow-scripts');
    expect(mockOpen).not.toHaveBeenCalled();
    expect(text(renderer!)).toContain('Run from viewer');
    expect(text(renderer!)).toContain('1.3.0');
  });

  test('lists selected views, labels unknown ones and loads a clip on click', async () => {
    await render(result(), repository(jest.fn().mockResolvedValue({ htmlBase64: btoa('x') })));

    const items = byTestId(renderer!, 'viewer-model-result-selected-view');
    expect(items).toHaveLength(2);
    expect(text(renderer!)).toContain('LAO cranial');
    expect(text(renderer!)).toContain('Unknown view');

    act(() => {
      fireEvent.click(items[1]);
    });
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
    expect(oneByTestId(renderer!, 'viewer-model-result-report-fallback')).toBeTruthy();
  });

  test('labels results without an api-pacs run as legacy automatic', async () => {
    await render(result({ trigger: null, reportAvailable: false }), repository(jest.fn()));

    expect(text(renderer!)).toContain('Automatic (legacy)');
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

    expect(oneByTestId(renderer!, 'viewer-model-result-no-details')).toBeTruthy();
    expect(mockOpen).not.toHaveBeenCalled();
  });

  describe('series scope', () => {
    const plain = { reportAvailable: false };
    const scopeNode = () => byTestId(renderer!, 'viewer-model-result-series-scope');
    const flat = (node: Element): string => node.textContent ?? '';

    test('shows nothing when the scope is not known', async () => {
      await render(result(plain), repository(jest.fn()));

      expect(scopeNode()).toHaveLength(0);
      expect(text(renderer!)).not.toContain('All series');
    });

    test('labels a full-study run without an accent', async () => {
      await render(result(plain), repository(jest.fn()), { kind: 'all', series: [] });

      const [scope] = scopeNode();
      expect(flat(scope)).toBe('All series');
      expect(scope.getAttribute('data-series-scope')).toBe('all');
      expect(scope.hasAttribute('tabindex')).toBe(false);
      expect(renderer!.container.innerHTML).not.toContain('border-[#3ef1d1]/60');
    });

    test('marks a subset run and lists its series on hover or focus', async () => {
      await render(result(plain), repository(jest.fn()), {
        kind: 'subset',
        used: 3,
        total: 12,
        series: [
          { seriesInstanceUID: 'series-2', seriesNumber: '2', description: 'LAO cranial' },
          { seriesInstanceUID: 'series-4', seriesNumber: '4', description: null },
          { seriesInstanceUID: 'series-5', seriesNumber: null, description: null },
        ],
      });

      const [scope] = scopeNode();
      expect(scope.getAttribute('data-series-scope')).toBe('subset');
      expect(scope.getAttribute('tabindex')).toBe('0');
      const [badge, list] = Array.from(scope.children);
      expect(flat(badge)).toBe('3 of 12 series');
      expect(badge.className).toContain('border-[#3ef1d1]/60');
      expect(list.className).toContain('hidden');
      expect(list.className).toContain('group-hover:block');
      expect(list.className).toContain('group-focus:block');
      expect(scope.getAttribute('aria-describedby')).toBe(list.id);
      // The series without a number or description is left out.
      expect(flat(list)).toBe('Series used by this run2 · LAO cranial4');
    });

    test('reports only the count when the total is unknown', async () => {
      await render(result(plain), repository(jest.fn()), { kind: 'count', used: 4, series: [] });

      const [scope] = scopeNode();
      expect(flat(scope)).toBe('4 series');
      expect(renderer!.container.querySelectorAll('[role="tooltip"]')).toHaveLength(0);
    });
  });
});
