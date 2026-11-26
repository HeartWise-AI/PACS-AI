import React from 'react';
import { TextDecoder } from 'util';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ViewerModelResultDrawer } from './ViewerModelResultDrawer';
import {
  createViewerResultsRepository,
  mapViewerModelResult,
  type ViewerResultsHTTPClient,
  type ViewerResultsRepository,
} from './viewerResultsRepository';
import {
  bestRunWithLabel,
  collectRunLabels,
  normalizeRunLabel,
  runLabelSuggestions,
  withRunLabels,
} from './viewerResultsModel';
import type { ViewerModelResult } from './types';

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
  ModelResultRenderer: () => <div data-testid="structured-result" />,
}));

jest.mock('./ViewerModelResultFeedback', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? key),
  }),
}));

function run(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '2.2.1',
    modality: 'angiogram',
    modelId: null,
    artifactModelId: null,
    containerId: null,
    runId: 'run-auto',
    executionId: 'execution-auto',
    studyServiceJobId: 'job-auto',
    completedAt: '2026-11-26T08:41:20Z',
    trigger: 'AUTO',
    selectedViews: null,
    reportAvailable: false,
    eligibleVideoCount: 4,
    labels: ['DIAGNOSTIC'],
    ...overrides,
  };
}

const autoRun = run({ bestRun: true });
const postPci = run({
  runId: 'run-post',
  executionId: 'execution-post',
  studyServiceJobId: 'job-post',
  completedAt: '2026-11-26T09:16:15Z',
  trigger: 'VIEWER_REQUEST',
  eligibleVideoCount: 1,
  labels: ['POST-PCI'],
  bestRun: false,
});
const postPciOlder = run({
  runId: 'run-post-0',
  executionId: 'execution-post-0',
  studyServiceJobId: 'job-post-0',
  completedAt: '2026-11-26T09:00:00Z',
  trigger: 'VIEWER_REQUEST',
  eligibleVideoCount: 2,
  labels: ['post-pci', 'Left'],
  bestRun: false,
});

function repository(overrides: Partial<ViewerResultsRepository> = {}): ViewerResultsRepository {
  return {
    loadLatestResults: jest.fn(),
    loadReport: jest.fn(),
    runModel: jest.fn(),
    loadRunStatus: jest.fn(),
    addRunLabel: jest.fn(async (_run, label) => ['DIAGNOSTIC', label]),
    removeRunLabel: jest.fn(async () => []),
    loadRunLabelSuggestions: jest.fn(async () => ['POST-PCI', 'Right']),
    ...overrides,
  };
}

describe('run label helpers', () => {
  test('labels are free text kept as typed within 40 characters', () => {
    expect(normalizeRunLabel('  post   PCI ')).toBe('post PCI');
    expect(normalizeRunLabel('é'.repeat(40))).toBe('é'.repeat(40));
    expect(normalizeRunLabel('x'.repeat(41))).toBeNull();
    expect(normalizeRunLabel('   ')).toBeNull();
    expect(normalizeRunLabel('a\u0000b')).toBeNull();
  });

  test('labels are collected once, without case, in the order met', () => {
    expect(collectRunLabels([postPci, postPciOlder, autoRun])).toEqual([
      'POST-PCI',
      'Left',
      'DIAGNOSTIC',
    ]);
  });

  test("a label's default run follows the best-run rule among the labelled runs", () => {
    const runs = [postPci, postPciOlder, autoRun];
    expect(bestRunWithLabel(runs, 'post-pci')).toBe(postPciOlder); // 2 videos beat 1
    expect(bestRunWithLabel(runs, 'DIAGNOSTIC')).toBe(autoRun);
    expect(
      bestRunWithLabel([postPci, { ...postPciOlder, eligibleVideoCount: undefined }], 'POST-PCI')
    ).toBe(postPci); // an unknown count: the newest
    expect(bestRunWithLabel(runs, 'RIGHT')).toBeNull();
  });

  test("a run's new labels replace the old ones wherever it is listed", () => {
    const reported = { ...autoRun, runs: [postPci, autoRun] };
    const [updated] = withRunLabels([reported], autoRun, ['DIAGNOSTIC', 'LEFT']);
    expect(updated.labels).toEqual(['DIAGNOSTIC', 'LEFT']);
    expect(updated.runs?.[1].labels).toEqual(['DIAGNOSTIC', 'LEFT']);
    expect(updated.runs?.[0].labels).toEqual(['POST-PCI']);
  });

  test('suggestions put workspace labels first and skip the run’s own', () => {
    expect(runLabelSuggestions(['Right', 'diagnostic'], ['DIAGNOSTIC'])).toEqual([
      'Right',
      'POST-PCI',
      'PRE-PCI',
      'LEFT',
    ]);
  });
});

describe('run label repository', () => {
  function client() {
    const labelsBody = {
      success: true,
      message: '',
      data: { labels: [{ label: 'POST-PCI', key: 'post-pci' }] },
    };
    return {
      get: jest.fn(async () => ({
        data: {
          success: true,
          message: '',
          data: { labels: [{ label: 'DIAGNOSTIC', runCount: 3 }] },
        },
      })),
      post: jest.fn(async () => ({ data: labelsBody })),
      delete: jest.fn(async () => ({ data: { ...labelsBody, data: { labels: [] } } })),
    } as unknown as jest.Mocked<Required<ViewerResultsHTTPClient>>;
  }

  test('maps the labels of a result and of its listed runs', () => {
    const mapped = mapViewerModelResult(
      {
        modelName: 'DeepCORO-JEPA',
        labels: ['DIAGNOSTIC', ' diagnostic '],
        runs: [{ modelName: 'x', labels: [] }],
      },
      '1.2.3'
    );
    expect(mapped?.labels).toEqual(['DIAGNOSTIC']);
    expect(mapped?.runs?.[0].labels).toEqual([]);
    expect(mapViewerModelResult({ modelName: 'old backend' }, '1.2.3')).not.toHaveProperty(
      'labels'
    );
  });

  test('adds, removes and suggests labels through api-pacs', async () => {
    const http = client();
    const repo = createViewerResultsRepository(http);

    await expect(repo.addRunLabel!(autoRun, 'POST-PCI')).resolves.toEqual(['POST-PCI']);
    expect(http.post).toHaveBeenCalledWith(
      '/v1/inference/worklist/studies/1.2.3/jobs/job-auto/labels',
      {
        label: 'POST-PCI',
      }
    );
    await expect(repo.removeRunLabel!(autoRun, 'post PCI')).resolves.toEqual([]);
    expect(http.delete).toHaveBeenCalledWith(
      '/v1/inference/worklist/studies/1.2.3/jobs/job-auto/labels?label=post%20PCI'
    );
    await expect(repo.loadRunLabelSuggestions!()).resolves.toEqual(['DIAGNOSTIC']);
    expect(http.get).toHaveBeenCalledWith('/v1/inference/worklist/run-labels');
    await expect(repo.addRunLabel!({ ...autoRun, studyServiceJobId: null }, 'X')).rejects.toThrow();
  });
});

describe('run labels in the result drawer', () => {
  function renderDrawer(props: Partial<React.ComponentProps<typeof ViewerModelResultDrawer>> = {}) {
    const onSelectRun = jest.fn();
    const onRunLabelsChanged = jest.fn();
    const repo = props.repository ?? repository();
    render(
      <ViewerModelResultDrawer
        result={autoRun}
        runs={[postPci, postPciOlder, autoRun]}
        onSelectRun={onSelectRun}
        canEditLabels
        onRunLabelsChanged={onRunLabelsChanged}
        repository={repo}
        onClose={jest.fn()}
        onMinimize={jest.fn()}
        onSelectView={() => true}
        {...props}
      />
    );
    return { onSelectRun, onRunLabelsChanged, repo };
  }

  test('shows the labels of the shown run and of every listed run', () => {
    renderDrawer({ canEditLabels: false });
    expect(screen.getAllByTestId('viewer-run-label').map(chip => chip.textContent)).toEqual([
      'DIAGNOSTIC',
    ]);
    expect(screen.queryByTestId('viewer-run-label-remove')).toBeNull();
    expect(screen.queryByTestId('viewer-run-label-input')).toBeNull();
    expect(
      screen.getAllByTestId('viewer-model-result-run-label').map(chip => chip.textContent)
    ).toEqual(['POST-PCI', 'post-pci', 'Left', 'DIAGNOSTIC']);
  });

  test('adds a free-text label with suggestions and reports the new labels', async () => {
    const { onRunLabelsChanged, repo } = renderDrawer();
    const options = () =>
      Array.from(document.querySelectorAll('datalist option')).map(option =>
        option.getAttribute('value')
      );
    await waitFor(() => expect(options()).toContain('Right'));
    expect(repo.loadRunLabelSuggestions).toHaveBeenCalled();
    expect(options()).toEqual(['POST-PCI', 'Right', 'PRE-PCI', 'LEFT']);
    expect(options()).not.toContain('DIAGNOSTIC');

    fireEvent.change(screen.getByTestId('viewer-run-label-input'), {
      target: { value: '  left  main ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('viewer-run-label-submit'));
    });

    expect(repo.addRunLabel).toHaveBeenCalledWith(autoRun, 'left main');
    expect(onRunLabelsChanged).toHaveBeenCalledWith(autoRun, ['DIAGNOSTIC', 'left main']);
  });

  test('refuses a label that is too long without calling the backend', async () => {
    const { repo } = renderDrawer();
    fireEvent.change(screen.getByTestId('viewer-run-label-input'), {
      target: { value: 'x'.repeat(41) },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('viewer-run-label-submit'));
    });
    expect(repo.addRunLabel).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('1 to 40');
  });

  test('removes the default label', async () => {
    const { onRunLabelsChanged, repo } = renderDrawer();
    await act(async () => {
      fireEvent.click(screen.getByTestId('viewer-run-label-remove'));
    });
    expect(repo.removeRunLabel).toHaveBeenCalledWith(autoRun, 'DIAGNOSTIC');
    expect(onRunLabelsChanged).toHaveBeenCalledWith(autoRun, []);
  });

  test('shows an error when the backend refuses the change', async () => {
    renderDrawer({
      repository: repository({
        removeRunLabel: jest.fn(async () => Promise.reject(new Error('403'))),
      }),
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('viewer-run-label-remove'));
    });
    expect(screen.getByRole('alert').textContent).toBe('The label could not be saved.');
  });

  test("filtering by a label lists its runs and opens that label's default run", () => {
    const { onSelectRun } = renderDrawer();
    const filter = (label: string) =>
      screen
        .getAllByTestId('viewer-run-label-filter-option')
        .find(option => option.getAttribute('data-label') === label) as HTMLElement;
    expect(
      screen.getAllByTestId('viewer-run-label-filter-option').map(option => option.textContent)
    ).toEqual(['All', 'POST-PCI', 'Left', 'DIAGNOSTIC']);

    fireEvent.click(filter('POST-PCI'));

    expect(onSelectRun).toHaveBeenCalledWith(postPciOlder);
    expect(screen.getAllByTestId('viewer-model-result-run')).toHaveLength(2);
    expect(filter('POST-PCI').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(filter(''));
    expect(screen.getAllByTestId('viewer-model-result-run')).toHaveLength(3);
  });

  test("a label's default run is opened even when the shown run carries the label", () => {
    const { onSelectRun } = renderDrawer({ result: postPci });
    const postFilter = screen
      .getAllByTestId('viewer-run-label-filter-option')
      .find(option => option.getAttribute('data-label') === 'POST-PCI') as HTMLElement;

    fireEvent.click(postFilter);

    expect(onSelectRun).toHaveBeenCalledWith(postPciOlder);
  });

  test('nothing is reopened when the shown run is already the label default', () => {
    const { onSelectRun } = renderDrawer({ result: postPciOlder });
    const postFilter = screen
      .getAllByTestId('viewer-run-label-filter-option')
      .find(option => option.getAttribute('data-label') === 'POST-PCI') as HTMLElement;

    fireEvent.click(postFilter);

    expect(onSelectRun).not.toHaveBeenCalled();
  });

  test('a backend without labels shows no label controls', () => {
    const { labels: _labels, ...unlabelled } = autoRun;
    renderDrawer({
      result: unlabelled as ViewerModelResult,
      runs: [unlabelled as ViewerModelResult],
    });
    expect(screen.queryByTestId('viewer-run-labels')).toBeNull();
    expect(screen.queryByTestId('viewer-run-label-filter')).toBeNull();
  });
});
