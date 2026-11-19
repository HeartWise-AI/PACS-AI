import React, { useContext } from 'react';
import { act, render as rtlRender, type RenderResult } from '@testing-library/react';
import { ChatCitationHostContext, type ChatCitationHost } from '@pacs-ai/extension-chat/citations';
import { ViewerModelResultsProvider } from './ViewerModelResultsProvider';
import type { ViewerResultsRepository } from './viewerResultsRepository';
import type { ViewerModelResult } from './types';

const mockInferenceProcessing = {
  canViewStudyProcessingRunHistory: true,
  canUseStudyProcessingREST: true,
};
const mockLoadExecutionResult = jest.fn();

jest.mock('@pacs-ai/extension-core/src/inferenceProcessing/InferenceProcessingProvider', () => ({
  useOptionalInferenceProcessing: () => mockInferenceProcessing,
}));

jest.mock('../studyProcessing/executionResultClient', () => ({
  createModelExecutionResultClient: () => ({ loadExecutionResult: mockLoadExecutionResult }),
}));

jest.mock('./ViewerModelResultDrawer', () => ({
  __esModule: true,
  default: ({ result }: { result: ViewerModelResult }) => (
    <div data-testid="drawer">{`${result.modelName}:${result.studyServiceJobId}`}</div>
  ),
}));

jest.mock('../runningJobs/ViewerRunningJobsIndicator', () => ({
  ViewerRunningJobsIndicator: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const STUDY_UID = '1.2.3';

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: STUDY_UID,
    modelName: 'DeepCORO-JEPA',
    modelVersion: '2.0.0',
    modality: 'angiogram',
    modelId: 'model-1',
    artifactModelId: 'deepcoro-jepa',
    containerId: 'container-1',
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: 'job-1',
    completedAt: '2026-11-13T09:00:00-05:00',
    trigger: 'AUTO',
    selectedViews: null,
    reportAvailable: true,
    ...overrides,
  };
}

const CITATION = {
  index: 1,
  kind: 'model_result' as const,
  modelName: 'DeepCORO-JEPA',
  modelVersion: '2.0.0',
  completedAt: '2026-11-13T09:00:00-05:00',
  studyInstanceUID: STUDY_UID,
  studyServiceJobId: 'job-1',
};

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

describe('ViewerModelResultsProvider as the host of the chat citations', () => {
  let renderer: RenderResult | null = null;
  let host: ChatCitationHost | null = null;

  // Stands for the chat, which is mounted under the provider.
  function Chat() {
    host = useContext(ChatCitationHostContext);
    return null;
  }

  async function render(results: ViewerModelResult[]) {
    const repository = {
      loadLatestResults: jest.fn().mockResolvedValue(results),
      loadReport: jest.fn(),
      runModel: jest.fn(),
      loadRunStatus: jest.fn(),
    } as unknown as jest.Mocked<ViewerResultsRepository>;
    await act(async () => {
      renderer = rtlRender(
        <ViewerModelResultsProvider
          studyInstanceUID={STUDY_UID}
          servicesManager={
            { services: { displaySetService: { getActiveDisplaySets: () => [] } } } as never
          }
          repository={repository}
        >
          <Chat />
        </ViewerModelResultsProvider>
      );
    });
    return repository;
  }

  const drawers = () => Array.from(renderer!.container.querySelectorAll('[data-testid="drawer"]'));

  beforeEach(() => {
    mockInferenceProcessing.canViewStudyProcessingRunHistory = true;
    mockLoadExecutionResult.mockReset();
    host = null;
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  it('loads the stored results up front and again when a citation is shown, then opens the cited result', async () => {
    const repository = await render([
      result({ modelName: 'DeepCORO-CTO', studyServiceJobId: 'job-2' }),
      result(),
    ]);

    // The open exam's results load as soon as the viewer opens; a citation
    // shown later asks again, since the cited result may be newer.
    await settle();
    expect(repository.loadLatestResults).toHaveBeenCalledTimes(1);
    expect(repository.loadLatestResults).toHaveBeenCalledWith(STUDY_UID);

    act(() => host!.onModelResultShown?.(CITATION));
    await settle();
    expect(repository.loadLatestResults).toHaveBeenCalledTimes(2);

    const actions = host!.resolveModelResult(CITATION);
    expect(actions.open).not.toBeNull();
    expect(drawers()).toHaveLength(0);
    act(() => actions.open?.());
    expect(drawers()).toHaveLength(1);
    expect(drawers()[0].textContent).toBe('DeepCORO-JEPA:job-1');
  });

  it('reads the raw data of the cited result from its model execution', async () => {
    mockLoadExecutionResult.mockResolvedValue({ runId: 'run-1', result: { syntax_score: 8 } });
    await render([result()]);
    act(() => host!.onModelResultShown?.(CITATION));
    await settle();

    await expect(host!.resolveModelResult(CITATION).loadRawResult?.()).resolves.toEqual({
      syntax_score: 8,
    });
    expect(mockLoadExecutionResult).toHaveBeenCalledWith({
      runId: 'run-1',
      executionId: 'execution-1',
    });
  });

  it('cannot open a result the viewer does not hold', async () => {
    await render([
      result({ studyServiceJobId: 'job-7', completedAt: '2026-11-14T08:00:00-05:00' }),
    ]);
    act(() => host!.onModelResultShown?.(CITATION));
    await settle();

    expect(host!.resolveModelResult(CITATION)).toEqual({
      open: null,
      loadRawResult: null,
      loading: false,
    });
  });

  it('offers nothing to a user who may not view stored results', async () => {
    mockInferenceProcessing.canViewStudyProcessingRunHistory = false;
    const repository = await render([result()]);
    act(() => host!.onModelResultShown?.(CITATION));
    await settle();

    expect(repository.loadLatestResults).not.toHaveBeenCalled();
    expect(host!.resolveModelResult(CITATION)).toEqual({ open: null, loadRawResult: null });
  });
});
