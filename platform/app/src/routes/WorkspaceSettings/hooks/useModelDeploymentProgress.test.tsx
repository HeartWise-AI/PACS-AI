import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import inferenceRepository from '../../../api/inferenceRepository';
import type { InferenceModelDeploymentEvent } from '../../../api/inferenceDTO';
import {
  createModelDeploymentMonitor,
  type ModelDeploymentMonitorCallbacks,
} from '../inference-models/modelDeploymentMonitor';
import { loadStoredModelDeployments } from '../inference-models/modelDeploymentStorage';
import { useModelDeploymentProgress } from './useModelDeploymentProgress';

jest.mock('../../../api/inferenceRepository');
jest.mock('../inference-models/modelDeploymentMonitor');

const mockedRepository = inferenceRepository as jest.Mocked<typeof inferenceRepository>;
const mockedCreateMonitor = createModelDeploymentMonitor as jest.MockedFunction<
  typeof createModelDeploymentMonitor
>;

let hookValue: ReturnType<typeof useModelDeploymentProgress>;

function Consumer({ onTerminal }: { onTerminal: jest.Mock }) {
  hookValue = useModelDeploymentProgress({ tenantId: 'tenant-a', onTerminal });
  return null;
}

describe('useModelDeploymentProgress', () => {
  let renderer: ReactTestRenderer;
  let callbacks: ModelDeploymentMonitorCallbacks;
  const start = jest.fn();
  const stop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockedCreateMonitor.mockImplementation((_modelId, _deploymentId, nextCallbacks) => {
      callbacks = nextCallbacks;
      return { start, stop };
    });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    localStorage.clear();
  });

  test('restores a persisted operation and removes it only after a terminal event', () => {
    localStorage.setItem(
      'pacs-ai:model-deployments:tenant-a',
      JSON.stringify([{ modelId: 'model-1', deploymentId: 'deployment-1' }])
    );
    const onTerminal = jest.fn();

    act(() => {
      renderer = TestRenderer.create(<Consumer onTerminal={onTerminal} />);
    });

    expect(mockedCreateMonitor).toHaveBeenCalledWith('model-1', 'deployment-1', expect.any(Object));
    expect(start).toHaveBeenCalledTimes(1);
    expect(hookValue.isDeploying('model-1')).toBe(true);

    const terminal: InferenceModelDeploymentEvent = {
      deploymentId: 'deployment-1',
      status: 'COMPLETED',
      stage: 'activate_candidate',
      sequence: 9,
      timestamp: 2000,
      elapsedMilliseconds: 1000,
      terminal: true,
    };
    act(() => callbacks.onTerminal(terminal));

    expect(loadStoredModelDeployments('tenant-a')).toEqual([]);
    expect(onTerminal).toHaveBeenCalledWith('model-1', terminal);
  });

  test('tracks the accepted deployment and prevents a duplicate submission', async () => {
    mockedRepository.DeployInferenceModelVersion.mockResolvedValue({
      success: true,
      message: 'accepted',
      data: { deploymentId: 'deployment-2', status: 'PENDING', stage: 'resolve_active' },
    });
    act(() => {
      renderer = TestRenderer.create(<Consumer onTerminal={jest.fn()} />);
    });

    await act(async () => {
      await hookValue.deploy('model-1', 'version-2');
    });
    await act(async () => {
      await hookValue.deploy('model-1', 'version-2');
    });

    expect(mockedRepository.DeployInferenceModelVersion).toHaveBeenCalledTimes(1);
    expect(loadStoredModelDeployments('tenant-a')).toEqual([
      { modelId: 'model-1', deploymentId: 'deployment-2' },
    ]);
    expect(hookValue.isDeploying('model-1')).toBe(true);
  });

  test('prevents duplicate submissions while the acceptance request is pending', async () => {
    let resolveDeployment!: (
      value: Awaited<ReturnType<typeof inferenceRepository.DeployInferenceModelVersion>>
    ) => void;
    mockedRepository.DeployInferenceModelVersion.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveDeployment = resolve;
        })
    );
    act(() => {
      renderer = TestRenderer.create(<Consumer onTerminal={jest.fn()} />);
    });

    let firstDeployment!: ReturnType<typeof hookValue.deploy>;
    await act(async () => {
      firstDeployment = hookValue.deploy('model-1', 'version-2');
      await hookValue.deploy('model-1', 'version-2');
    });

    expect(mockedRepository.DeployInferenceModelVersion).toHaveBeenCalledTimes(1);
    expect(hookValue.isDeploying('model-1')).toBe(true);

    await act(async () => {
      resolveDeployment({
        success: true,
        message: 'accepted',
        data: { deploymentId: 'deployment-2', status: 'PENDING', stage: 'resolve_active' },
      });
      await firstDeployment;
    });
  });
});
