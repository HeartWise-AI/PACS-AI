import React from 'react';
import { act, render, type RenderResult } from '@testing-library/react';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import type { InferenceModelDeploymentEvent } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import { useInferenceModels } from './useInferenceModels';
import { useModelDeploymentProgress } from './useModelDeploymentProgress';
import { AlertContext } from '../../../alerts';

jest.mock('@pacs-ai/extension-core/src/api/inferenceRepository');
jest.mock('./useModelDeploymentProgress');
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

const mockedRepository = inferenceRepository as jest.Mocked<typeof inferenceRepository>;
const mockedProgress = useModelDeploymentProgress as jest.MockedFunction<
  typeof useModelDeploymentProgress
>;

let hookValue: ReturnType<typeof useInferenceModels>;
let progressOptions: Parameters<typeof useModelDeploymentProgress>[0];

const showAlert = jest.fn();

function Probe() {
  hookValue = useInferenceModels({ enabled: false });
  return null;
}

function Consumer() {
  return (
    <AlertContext.Provider value={showAlert}>
      <Probe />
    </AlertContext.Provider>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const versionsResponse = (modelId: string) => ({
  success: true,
  message: 'ok',
  data: [{ id: `${modelId}-v2`, version: '2.0.0' }],
});

const row = (id: string) => ({ id }) as Parameters<typeof hookValue.openModelVersionsModal>[0];

describe('useInferenceModels', () => {
  let renderer: RenderResult;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('tenantId', 'tenant-a');
    localStorage.setItem('sessionToken', 'token');
    mockedRepository.GetInferenceAvailableModels.mockResolvedValue({
      success: true,
      message: 'ok',
      data: [],
    } as never);
    mockedProgress.mockImplementation(options => {
      progressOptions = options;
      return { deployments: {}, deploy: jest.fn(), moveGPU: jest.fn(), isDeploying: () => false };
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    localStorage.clear();
  });

  test('a slower version list for a model the user left does not replace the current one', async () => {
    const forA = deferred<ReturnType<typeof versionsResponse>>();
    const forB = deferred<ReturnType<typeof versionsResponse>>();
    mockedRepository.GetInferenceModelVersions.mockImplementation(
      (modelId: string) => (modelId === 'model-a' ? forA.promise : forB.promise) as never
    );
    await act(async () => {
      renderer = render(<Consumer />);
    });

    act(() => hookValue.openModelVersionsModal(row('model-a')));
    act(() => hookValue.closeModelVersionsModal());
    act(() => hookValue.openModelVersionsModal(row('model-b')));

    await act(async () => forB.resolve(versionsResponse('model-b')));
    await act(async () => forA.resolve(versionsResponse('model-a')));

    expect(hookValue.versionModel?.id).toBe('model-b');
    expect(hookValue.modelVersions.map(version => version.id)).toEqual(['model-b-v2']);
  });

  test('a completed deployment refreshes the available models used by ingestion jobs', async () => {
    mockedRepository.GetInferenceModels.mockResolvedValue({
      success: true,
      message: 'ok',
      data: [],
    } as never);
    await act(async () => {
      renderer = render(<Consumer />);
    });
    expect(mockedRepository.GetInferenceAvailableModels).toHaveBeenCalledTimes(1);

    const completed = {
      deploymentId: 'deployment-1',
      status: 'COMPLETED',
      stage: 'activate_candidate',
      sequence: 4,
      timestamp: 2000,
      elapsedMilliseconds: 900,
      terminal: true,
    } as InferenceModelDeploymentEvent;
    await act(async () => progressOptions.onTerminal('model-a', completed));

    expect(mockedRepository.GetInferenceAvailableModels).toHaveBeenCalledTimes(2);
  });
});
