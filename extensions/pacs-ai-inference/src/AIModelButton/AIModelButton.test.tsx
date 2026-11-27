import React from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import AIModelButton from './AIModelButton';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';
import { useViewerModelResults } from '../viewerResults/ViewerModelResultsProvider';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      options.modelName ? `${key}:${options.modelName}` : key,
  }),
}));
jest.mock('@pacs-ai/extension-core/src/api/dto', () => ({
  Error: { UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' },
}));
jest.mock('@pacs-ai/extension-core/src/service/userService', () => ({ logoutUser: jest.fn() }));
jest.mock('@pacs-ai/extension-core/src/api/inferenceRepository', () => ({
  __esModule: true,
  default: { PredictInferenceModel: jest.fn(), GetInferenceAvailableModels: jest.fn() },
}));
jest.mock('@pacs-ai/extension-core/src/providers/AlertProvider', () => ({
  AlertContext: jest.requireActual('react').createContext(null),
}));
const mockStudyContext = {
  selectedModalities: { XA: { modality: 'XA' } } as Record<string, unknown>,
};
jest.mock('@pacs-ai/extension-core/src/hooks/useStudyContext', () => ({
  __esModule: true,
  default: () => mockStudyContext,
}));
jest.mock('../utils/addSegmentation', () => ({
  addSegmentationFromLabelmap: jest.fn(),
}));
jest.mock('../viewerResults/ViewerModelResultsProvider', () => ({
  useViewerModelResults: jest.fn(),
}));
// The modals are replaced by stubs that render a marker element and record the props of
// each mounted instance, keyed by that element.
const mockStubProps = new WeakMap<Element, Record<string, any>>();
function mockRecordingStub(name: string) {
  return function RecordingStub(props: Record<string, any>) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    React.useLayoutEffect(() => {
      mockStubProps.set(ref.current!, props);
    });
    return (
      <div
        data-stub={name}
        ref={ref}
      />
    );
  };
}
jest.mock('../JSONOutputModeModal', () => mockRecordingStub('json-output-modal'));
jest.mock('../WebappOutputModeModal', () => mockRecordingStub('webapp-output-modal'));
jest.mock('../HTMLOutputModeModal', () => mockRecordingStub('html-output-modal'));
jest.mock('../PDFOutputModeModal', () => mockRecordingStub('pdf-output-modal'));
jest.mock('@pacs-ai/ui/src/components/SelectSeriesModal', () =>
  mockRecordingStub('select-series-modal')
);

const model = {
  modelId: 'deepcoro-jepa',
  containerId: 'container-1',
  containerName: 'deepcoro',
  modelName: 'DeepCORO-JEPA',
  version: '1.3.0',
  outputMode: 'HTML',
  supportedDicomModalities: ['XA'],
  supportedAdditionalMetadata: [],
};
const storedResult = { runId: 'run-1', completedAt: '2026-11-10T10:00:00Z' };

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

describe('AIModelButton runs', () => {
  let renderer: RenderResult;
  const showAlert = jest.fn();
  const predict = inferenceRepository.PredictInferenceModel as jest.Mock;

  const viewerResults = (overrides = {}) => ({
    canRunManaged: true,
    refreshLatestResults: jest.fn().mockResolvedValue(undefined),
    getLatestResult: jest.fn().mockReturnValue(null),
    getPendingRun: jest.fn().mockReturnValue(null),
    startManagedRun: jest.fn(),
    startForegroundRun: jest.fn().mockReturnValue(new Promise(() => {})),
    dismissForegroundRun: jest.fn(),
    openResult: jest.fn(),
    ...overrides,
  });

  // The menu is portalled to the document body.
  const all = (selector: string) => Array.from(document.body.querySelectorAll(selector));
  const openMenu = () => {
    const buttons = all('[data-tour-id="ai-model-button"]');
    expect(buttons).toHaveLength(1);
    act(() => {
      fireEvent.click(buttons[0]);
    });
  };

  const mount = (provider: ReturnType<typeof viewerResults> | null, models = [model]) => {
    (useViewerModelResults as jest.Mock).mockReturnValue(provider);
    renderer = render(
      <AlertContext.Provider value={showAlert}>
        <AIModelButton
          servicesManager={{}}
          inferenceAvailableModels={models}
        />
      </AlertContext.Provider>
    );
    openMenu();
  };

  const seriesModals = () => all('[data-stub="select-series-modal"]');
  // The props the first series pop-up was last rendered with.
  const seriesModal = () => ({ props: mockStubProps.get(seriesModals()[0])! });
  // Clicks the one element that holds this exact text; the click reaches its handler.
  const clickText = (text: string) => {
    const nodes = all('*').filter(element =>
      Array.from(element.childNodes).some(
        child => child.nodeType === Node.TEXT_NODE && child.textContent === text
      )
    );
    expect(nodes).toHaveLength(1);
    act(() => {
      fireEvent.click(nodes[0]);
    });
  };
  const confirmSeries = async (series = ['series-1', 'series-2'], study = '1.2.3') => {
    await act(async () => {
      void seriesModal().props.applyPredictInferenceModel(
        model.containerId,
        series,
        study,
        {},
        model.outputMode
      );
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    predict.mockResolvedValue({ data: { html: '<p>report</p>' } });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    renderer?.unmount();
    jest.restoreAllMocks();
  });

  test('with a TTE and an angiogram open, each exam lists only its models and its own results', () => {
    const echoModel = {
      ...model,
      modelId: 'panecho',
      containerId: 'container-echo',
      containerName: 'panecho',
      modelName: 'PanEcho',
      supportedDicomModalities: ['US'],
    };
    mockStudyContext.selectedModalities = {
      US: {
        modality: 'US',
        studies: [{ studyInstanceUID: 'tte', date: '2026-10-09', description: 'TTE' }],
      },
      XA: {
        modality: 'XA',
        studies: [{ studyInstanceUID: 'cath', date: '2026-11-17', description: 'CATH' }],
      },
    };
    const getLatestResult = jest.fn((m: { modelName: string }, study: string) =>
      m.modelName === 'DeepCORO-JEPA' && study === 'cath' ? storedResult : null
    );
    try {
      mount(viewerResults({ getLatestResult }), [model, echoModel]);

      const headers = all('[data-testid="ai-model-menu-exam"]').map(item => item.textContent);
      expect(headers).toEqual(['US · 2026-10-09 · TTE', 'XA · 2026-11-17 · CATH']);
      const rows = all('li').map(item => item.textContent || '');
      const panEchoRows = rows.filter(text => text.includes('PanEcho'));
      const jepaRows = rows.filter(text => text.includes('DeepCORO-JEPA'));
      expect(panEchoRows).toHaveLength(1);
      expect(jepaRows).toHaveLength(1);
      expect(getLatestResult).toHaveBeenCalledWith(echoModel, 'tte');
      expect(getLatestResult).toHaveBeenCalledWith(model, 'cath');
      expect(getLatestResult).not.toHaveBeenCalledWith(echoModel, 'cath');
      // The angiogram's stored result is offered; the TTE's PanEcho has none yet.
      expect(all('[data-testid="ai-model-previous-result"]')).toHaveLength(1);
    } finally {
      mockStudyContext.selectedModalities = { XA: { modality: 'XA' } };
    }
  });

  describe('stored study-service results (echo SR measurements)', () => {
    const srResult = {
      studyInstanceUID: 'tte',
      modelName: 'echo-sr-measurements',
      modelVersion: '1.0.0',
      studyServiceJobId: 'job-sr',
      completedAt: '2026-11-10T10:00:00Z',
    };
    const echoModel = {
      ...model,
      modelId: 'panecho',
      containerId: 'container-echo',
      modelName: 'PanEcho',
      supportedDicomModalities: ['US'],
    };
    const tteOpen = {
      US: { modality: 'US', studies: [{ studyInstanceUID: 'tte', date: '2026-10-09' }] },
    };

    afterEach(() => {
      mockStudyContext.selectedModalities = { XA: { modality: 'XA' } };
    });

    test('are listed in the exam block next to the echo models, once', () => {
      mockStudyContext.selectedModalities = tteOpen;
      const openResult = jest.fn();
      mount(
        viewerResults({
          openResult,
          getStudyServiceResults: jest.fn((study: string) => (study === 'tte' ? [srResult] : [])),
          getOpenStudyServiceResults: jest.fn(() => [srResult]),
        }),
        [echoModel]
      );

      const rows = all('[data-testid="ai-model-study-service-result"]');
      expect(rows).toHaveLength(1);
      expect(rows[0].textContent).toContain('EchoSrTitle');
      // Shown inside the model section, not repeated in the unlisted block.
      expect(all('[data-testid="ai-model-study-service-results"]')).toHaveLength(0);
      act(() => {
        fireEvent.click(rows[0].querySelector('button')!);
      });
      expect(openResult).toHaveBeenCalledWith(srResult);
    });

    test('are listed even when no echo model is available', () => {
      mockStudyContext.selectedModalities = tteOpen;
      mount(
        viewerResults({
          getStudyServiceResults: jest.fn(() => [srResult]),
          getOpenStudyServiceResults: jest.fn(() => [srResult]),
        }),
        [model]
      );

      const block = all('[data-testid="ai-model-study-service-results"]');
      expect(block).toHaveLength(1);
      expect(
        block[0].querySelectorAll('[data-testid="ai-model-study-service-result"]')
      ).toHaveLength(1);
      // The "no models" notice stays for the models themselves.
      expect(all('[data-testid="ai-model-menu-empty"]')).toHaveLength(1);
    });
  });

  test('Apply opens the series pop-up instead of queueing a run', () => {
    const provider = viewerResults();
    mount(provider);

    clickText('Apply ');

    expect(seriesModals()).toHaveLength(1);
    expect(seriesModal().props).toMatchObject({ isOpen: true, loading: false });
    expect(seriesModal().props.onDismissLoading).toBeUndefined();
    expect(provider.startManagedRun).not.toHaveBeenCalled();
    expect(provider.startForegroundRun).not.toHaveBeenCalled();
  });

  test('confirming Rerun opens the series pop-up', () => {
    const provider = viewerResults({ getLatestResult: jest.fn().mockReturnValue(storedResult) });
    mount(provider);

    clickText('ViewerRerun');
    expect(seriesModals()).toHaveLength(0);
    clickText('ViewerRerunConfirmAction');

    expect(seriesModals()).toHaveLength(1);
    expect(provider.startForegroundRun).not.toHaveBeenCalled();
  });

  test('confirming the series starts a managed run with them and waits in the pop-up', async () => {
    const run = deferred<{ status: string }>();
    const provider = viewerResults({ startForegroundRun: jest.fn().mockReturnValue(run.promise) });
    mount(provider);
    clickText('Apply ');

    await confirmSeries();

    expect(provider.startForegroundRun).toHaveBeenCalledWith({
      model,
      modality: null,
      seriesInstanceUIDs: ['series-1', 'series-2'],
      studyInstanceUID: '1.2.3',
    });
    expect(provider.startManagedRun).not.toHaveBeenCalled();
    expect(predict).not.toHaveBeenCalled();
    expect(seriesModal().props).toMatchObject({
      loading: true,
      loadingMessage: 'ViewerRunForeground:DeepCORO-JEPA',
      dismissLoadingLabel: 'ViewerRunForegroundDismiss',
    });

    // The provider opens the result itself; the pop-up only has to close.
    await act(async () => {
      run.resolve({ status: 'completed' });
    });
    expect(seriesModals()).toHaveLength(0);
    expect(showAlert).not.toHaveBeenCalled();
  });

  test('dismissing the pop-up stops waiting and leaves the run to the provider', async () => {
    const run = deferred<{ status: string }>();
    const provider = viewerResults({ startForegroundRun: jest.fn().mockReturnValue(run.promise) });
    provider.dismissForegroundRun.mockImplementation(() => run.resolve({ status: 'dismissed' }));
    mount(provider);
    clickText('Apply ');
    await confirmSeries();

    await act(async () => {
      seriesModal().props.onDismissLoading();
    });

    expect(provider.dismissForegroundRun).toHaveBeenCalledTimes(1);
    expect(seriesModals()).toHaveLength(0);

    // The pop-up is usable again for another run.
    openMenu();
    clickText('Apply ');
    expect(seriesModal().props.loading).toBe(false);
  });

  test('a start error is shown and keeps the pop-up usable', async () => {
    const provider = viewerResults({
      startForegroundRun: jest.fn().mockRejectedValue(new Error('ViewerRunQuotaExceeded')),
    });
    mount(provider);
    clickText('Apply ');

    await confirmSeries();

    expect(showAlert).toHaveBeenCalledWith('ViewerRunQuotaExceeded', 'error');
    expect(seriesModals()).toHaveLength(1);
    expect(seriesModal().props).toMatchObject({ isOpen: true, loading: false });
    expect(seriesModal().props.loadingMessage).toBeUndefined();
  });

  test.each(['failed', 'timedOut'])(
    'a run that ends %s stops the busy state and keeps the pop-up open',
    async status => {
      const provider = viewerResults({
        startForegroundRun: jest.fn().mockResolvedValue({ status }),
      });
      mount(provider);
      clickText('Apply ');

      await confirmSeries();

      expect(seriesModals()).toHaveLength(1);
      expect(seriesModal().props.loading).toBe(false);
    }
  );

  const expectDirectPredict = () => {
    expect(predict).toHaveBeenCalledWith('container-1', {
      studyInstanceUID: '1.2.3',
      seriesInstanceUIDs: ['series-1', 'series-2'],
      additionalMetadata: {},
    });
    expect(seriesModals()).toHaveLength(0);
    expect(all('[data-stub="html-output-modal"]')).toHaveLength(1);
  };

  test('falls back to the direct predict call when the provider reports fallback', async () => {
    const provider = viewerResults({
      startForegroundRun: jest.fn().mockResolvedValue({ status: 'fallback' }),
    });
    mount(provider);
    clickText('Apply ');

    await confirmSeries();

    expectDirectPredict();
  });

  test('keeps the direct predict call for models that need additional metadata', async () => {
    const provider = viewerResults();
    mount(provider, [{ ...model, supportedAdditionalMetadata: [{ id: 'age' }] } as never]);
    clickText('Apply ');

    await confirmSeries();

    expect(provider.startForegroundRun).not.toHaveBeenCalled();
    expectDirectPredict();
  });

  test('keeps the direct predict call for segmentation models (OHIF_ANNOTATIONS)', async () => {
    const provider = viewerResults();
    mount(provider, [{ ...model, outputMode: 'OHIF_ANNOTATIONS' } as never]);
    clickText('Apply ');

    await confirmSeries();

    expect(provider.startForegroundRun).not.toHaveBeenCalled();
    expect(predict).toHaveBeenCalled();
  });

  test('keeps the direct predict call outside the viewer results provider', async () => {
    mount(null);
    clickText('Apply ');

    await confirmSeries();

    expectDirectPredict();
  });

  test.each([
    ['a subset run', { kind: 'subset', used: 4, total: 12, series: [] }, 1],
    ['a full-study run', { kind: 'all', series: [] }, 0],
    ['a run of unknown total', { kind: 'count', used: 4, series: [] }, 0],
    ['an unknown scope', null, 0],
  ])('marks the latest result of %s', (_name, scope, markers) => {
    const getResultSeriesScope = jest.fn().mockReturnValue(scope);
    mount(
      viewerResults({
        getLatestResult: jest.fn().mockReturnValue(storedResult),
        getResultSeriesScope,
      })
    );

    expect(getResultSeriesScope).toHaveBeenCalledWith(storedResult);
    const found = all('[data-testid="ai-model-result-subset"]');
    expect(found).toHaveLength(markers);
    if (markers) {
      expect(found[0].textContent).toBe(' · ViewerResultSeriesCount');
    }
  });

  test('shows stored results from a provider without series scope support', () => {
    mount(viewerResults({ getLatestResult: jest.fn().mockReturnValue(storedResult) }));

    expect(all('[data-testid="ai-model-result-subset"]')).toHaveLength(0);
    expect(all('[data-testid="ai-model-previous-result"]')).toHaveLength(1);
  });

  test('offers the newest run next to the default result when it is not the best run', () => {
    const bestRun = {
      studyInstanceUID: '1.2.3',
      modelName: 'DeepCORO-JEPA',
      runId: 'run-auto',
      executionId: 'execution-auto',
      completedAt: '2026-11-26T08:41:20-05:00',
    };
    const rerun = { ...bestRun, runId: 'run-viewer', executionId: 'execution-viewer' };
    const provider = viewerResults({
      getLatestResult: jest.fn().mockReturnValue(bestRun),
      getResultRuns: jest.fn().mockReturnValue([rerun, bestRun]),
    });
    mount(provider);

    const latest = all('[data-testid="ai-model-latest-run"]');
    expect(latest).toHaveLength(1);
    act(() => {
      fireEvent.click(latest[0]);
    });
    expect(provider.openResult).toHaveBeenCalledWith(rerun);
  });

  test('shows no latest-run button when the default result is the newest run', () => {
    const only = {
      studyInstanceUID: '1.2.3',
      modelName: 'DeepCORO-JEPA',
      runId: 'run-auto',
      executionId: 'execution-auto',
      completedAt: '2026-11-26T08:41:20-05:00',
    };
    mount(
      viewerResults({
        getLatestResult: jest.fn().mockReturnValue(only),
        getResultRuns: jest.fn().mockReturnValue([only]),
      })
    );

    expect(all('[data-testid="ai-model-latest-run"]')).toHaveLength(0);
    expect(all('[data-testid="ai-model-previous-result"]')).toHaveLength(1);
  });
});

describe('AIModelButton model list', () => {
  const getModels = inferenceRepository.GetInferenceAvailableModels as jest.Mock;
  const panEcho = {
    modelId: 'panecho',
    containerId: 'container-panecho',
    containerName: 'panecho',
    modelName: 'PanEcho',
    version: '1.0.3',
    outputMode: 'HTML',
    supportedDicomModalities: ['US'],
    supportedAdditionalMetadata: [],
  };

  beforeEach(() => {
    const { pacsAiModelsService } = jest.requireActual(
      '@pacs-ai/extension-core/src/services/PacsAiModelsService'
    );
    pacsAiModelsService.reset();
    getModels.mockReset();
    mockStudyContext.selectedModalities = { 'US\\SR': { modality: 'US\\SR' } };
    (useViewerModelResults as jest.Mock).mockReturnValue(null);
  });

  afterEach(() => {
    mockStudyContext.selectedModalities = { XA: { modality: 'XA' } };
  });

  function renderButton(models: unknown[]) {
    return render(
      <AlertContext.Provider value={jest.fn() as any}>
        <AIModelButton
          servicesManager={{ services: {} } as any}
          inferenceAvailableModels={models as any}
        />
      </AlertContext.Provider>
    );
  }

  test('opening the menu asks api-pacs again for the models', async () => {
    getModels.mockResolvedValue({ data: [panEcho] });
    const { container } = renderButton([model]);

    await act(async () => {
      fireEvent.click(container.querySelector('[data-tour-id="ai-model-button"]')!);
    });

    expect(getModels).toHaveBeenCalledTimes(1);
  });

  test('a study whose model is missing offers a retry instead of a dead end', async () => {
    getModels.mockResolvedValue({ data: [model] });
    const { container, getByText } = renderButton([model]);

    await act(async () => {
      fireEvent.click(container.querySelector('[data-tour-id="ai-model-button"]')!);
    });

    expect(getByText('No inference models found')).toBeTruthy();
    expect(getByText('ModelsMayBeBusy')).toBeTruthy();
    await act(async () => {
      fireEvent.click(getByText('TryAgain'));
    });
    expect(getModels).toHaveBeenCalledTimes(2);
  });
});
