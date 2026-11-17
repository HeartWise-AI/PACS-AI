import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import AIModelButton from './AIModelButton';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import { AlertContext } from '@pacs-ai/extension-core/src/providers/AlertProvider';
import { useViewerModelResults } from '@ohif/app/src/components/inference/viewerResults/ViewerModelResultsProvider';

jest.mock('react-dom', () => ({ createPortal: children => children }));
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
  default: { PredictInferenceModel: jest.fn() },
}));
jest.mock('@pacs-ai/extension-core/src/providers/AlertProvider', () => ({
  AlertContext: jest.requireActual('react').createContext(null),
}));
jest.mock('@pacs-ai/extension-core/src/hooks/useStudyContext', () => ({
  __esModule: true,
  default: () => ({ selectedModalities: { XA: { modality: 'XA' } } }),
}));
jest.mock('../../../../cornerstone/src/utils/addSegmentation', () => ({
  addSegmentationFromLabelmap: jest.fn(),
}));
jest.mock('@ohif/app/src/components/inference/viewerResults/ViewerModelResultsProvider', () => ({
  useViewerModelResults: jest.fn(),
}));
jest.mock('@ohif/app/src/components/inference/JSONOutputModeModal', () => 'json-output-modal');
jest.mock('@ohif/app/src/components/inference/WebappOutputModeModal', () => 'webapp-output-modal');
jest.mock('@ohif/app/src/components/inference/HTMLOutputModeModal', () => 'html-output-modal');
jest.mock('@ohif/app/src/components/inference/PDFOutputModeModal', () => 'pdf-output-modal');
jest.mock('@ohif/app/src/components/inference/SelectSeriesModal', () => 'select-series-modal');

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
  let renderer: ReactTestRenderer;
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

  const openMenu = () =>
    act(() =>
      renderer.root.findByProps({ 'data-tour-id': 'ai-model-button' }).props.onClick({
        currentTarget: { getBoundingClientRect: () => ({ bottom: 0, left: 0 }) },
      })
    );

  const mount = (provider: ReturnType<typeof viewerResults> | null, models = [model]) => {
    (useViewerModelResults as jest.Mock).mockReturnValue(provider);
    act(() => {
      renderer = TestRenderer.create(
        <AlertContext.Provider value={showAlert}>
          <AIModelButton
            servicesManager={{}}
            inferenceAvailableModels={models}
          />
        </AlertContext.Provider>
      );
    });
    openMenu();
  };

  const seriesModals = () => renderer.root.findAllByType('select-series-modal' as never);
  const seriesModal = () => seriesModals()[0];
  const clickText = (text: string) => {
    const node = renderer.root.find(
      item => typeof item.type === 'string' && item.children.includes(text)
    );
    let target = node;
    while (!target.props.onClick) {
      target = target.parent!;
    }
    act(() => target.props.onClick());
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
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
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
    expect(renderer.root.findAllByType('html-output-modal' as never)).toHaveLength(1);
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
    const found = renderer.root.findAllByProps({ 'data-testid': 'ai-model-result-subset' });
    expect(found).toHaveLength(markers);
    if (markers) {
      expect(found[0].children.join('')).toBe(' · ViewerResultSeriesCount');
    }
  });

  test('shows stored results from a provider without series scope support', () => {
    mount(viewerResults({ getLatestResult: jest.fn().mockReturnValue(storedResult) }));

    expect(renderer.root.findAllByProps({ 'data-testid': 'ai-model-result-subset' })).toHaveLength(
      0
    );
    expect(
      renderer.root.findAllByProps({ 'data-testid': 'ai-model-previous-result' })
    ).toHaveLength(1);
  });
});
