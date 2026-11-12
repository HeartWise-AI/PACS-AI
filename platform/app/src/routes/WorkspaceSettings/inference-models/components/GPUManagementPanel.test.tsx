import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import GPUManagementPanel from './GPUManagementPanel';
import { useGPUInventory } from '../../hooks/useGPUInventory';
import userRepository from '../../../../api/userRepository';
import type { UseInferenceModelsResult } from '../../hooks/useInferenceModels';
jest.mock('../../hooks/useGPUInventory');
jest.mock('../../../../api/userRepository');
jest.mock('./ModelDeploymentProgressPanel', () => () => null);
const inventory = {
  sampledAt: '2026-11-12T00:00:00Z',
  managerEnabled: true,
  managerReady: true,
  devices: [
    {
      uuid: 'GPU-a',
      index: null,
      name: 'A5000',
      totalMemoryMiB: 24000,
      usedMemoryMiB: 6000,
      freeMemoryMiB: 18000,
      utilizationPercent: 10,
      telemetryStatus: 'available',
      managerCapacityMiB: 20000,
      managerReservedMiB: 9000,
      managerAvailableMiB: 11000,
    },
    {
      uuid: 'GPU-b',
      index: null,
      name: null,
      totalMemoryMiB: null,
      usedMemoryMiB: null,
      freeMemoryMiB: null,
      utilizationPercent: null,
      telemetryStatus: 'unavailable',
      managerCapacityMiB: 20000,
      managerReservedMiB: 0,
      managerAvailableMiB: 20000,
    },
  ],
  models: [
    {
      modelId: 'm1',
      containerId: 'old-container',
      gpuUuid: 'GPU-a',
      desiredGpuUuid: 'GPU-a',
      placementSupported: true,
    },
  ],
};
describe('GPUManagementPanel', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let moveGPU: jest.Mock;
  let inference: UseInferenceModelsResult;
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('tenantId', 'tenant-a');
    localStorage.setItem('sessionToken', 'token-a');
    moveGPU = jest.fn().mockResolvedValue(undefined);
    inference = {
      models: [{ id: 'm1', name: 'JEPA' }],
      gpuDeployments: {},
      isModelDeploying: () => false,
      moveGPU,
    } as unknown as UseInferenceModelsResult;
    (userRepository.GetCurrentUser as jest.Mock).mockResolvedValue({
      data: { role: 'ADMIN', tenantId: 'tenant-a' },
    });
    (useGPUInventory as jest.Mock).mockReturnValue({
      inventory,
      stale: false,
      error: false,
      loading: false,
    });
  });
  afterEach(() => act(() => renderer?.unmount()));
  const mount = async () => {
    await act(async () => {
      renderer = TestRenderer.create(
        <GPUManagementPanel
          active
          inference={inference}
        />
      );
    });
  };
  test('separates measured memory from reservations and labels missing telemetry', async () => {
    await mount();
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('Device memory: ');
    expect(text).toContain('6,000 MiB');
    expect(text).toContain('Scheduler reserved: ');
    expect(text).toContain('9,000 MiB');
    expect(text).toContain('Device telemetry unavailable');
    expect(text).toContain('GPU-a');
    expect(text).toContain('GPU-b');
    expect(renderer.root.findAllByProps({ role: 'progressbar' })).toHaveLength(1);
  });
  test('requires confirmation then sends exact target and expected container identity', async () => {
    await mount();
    act(() => renderer.root.findByType('select').props.onChange({ target: { value: 'GPU-b' } }));
    const move = renderer.root
      .findAllByType('button')
      .find(node => node.children.includes('Move to GPU'))!;
    act(() => move.props.onClick());
    expect(moveGPU).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).toContain('same model version');
    await act(async () => {
      await renderer.root
        .findAllByType('button')
        .find(node => node.children.includes('Confirm GPU change'))!
        .props.onClick();
    });
    expect(moveGPU).toHaveBeenCalledWith('m1', 'GPU-b', 'old-container');
  });
  test('disables placement on stale inventory and does not expose GPU controls to users', async () => {
    (useGPUInventory as jest.Mock).mockReturnValue({
      inventory,
      stale: true,
      error: true,
      loading: false,
    });
    await mount();
    expect(renderer.root.findByType('select').props.disabled).toBe(true);
    expect(renderer.root.findAllByProps({ role: 'progressbar' })).toHaveLength(0);
    (userRepository.GetCurrentUser as jest.Mock).mockResolvedValue({ data: { role: 'USER' } });
    await act(async () =>
      renderer.update(
        <GPUManagementPanel
          active={false}
          inference={inference}
        />
      )
    );
    await act(async () =>
      renderer.update(
        <GPUManagementPanel
          active
          inference={inference}
        />
      )
    );
    expect(renderer.toJSON()).toBeNull();
  });
  test('rotating the session clears an open confirmation and selected target before reauthorization', async () => {
    await mount();
    act(() => renderer.root.findByType('select').props.onChange({ target: { value: 'GPU-b' } }));
    act(() =>
      renderer.root
        .findAllByType('button')
        .find(node => node.children.includes('Move to GPU'))!
        .props.onClick()
    );
    expect(renderer.root.findAllByProps({ 'aria-label': 'Confirm GPU change' })).toHaveLength(1);
    await act(async () => {
      localStorage.setItem('sessionToken', 'token-b');
      window.dispatchEvent(new StorageEvent('storage', { key: 'sessionToken' }));
    });
    expect(renderer.root.findAllByProps({ 'aria-label': 'Confirm GPU change' })).toHaveLength(0);
    expect(renderer.root.findByType('select').props.value).toBe('GPU-a');
    expect(moveGPU).not.toHaveBeenCalled();
  });

  test('an old tenant role response cannot authorize the replacement session', async () => {
    let finishOld!: (value: any) => void;
    (userRepository.GetCurrentUser as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(done => {
          finishOld = done;
        })
    );
    await mount();
    expect(renderer.toJSON()).toBeNull();
    (userRepository.GetCurrentUser as jest.Mock).mockResolvedValue({
      data: { role: 'USER', tenantId: 'tenant-b' },
    });
    await act(async () => {
      localStorage.setItem('tenantId', 'tenant-b');
      localStorage.setItem('sessionToken', 'token-b');
      window.dispatchEvent(new StorageEvent('storage', { key: 'tenantId' }));
    });
    await act(async () => {
      finishOld({ data: { role: 'ADMIN', tenantId: 'tenant-a' } });
    });
    expect(renderer.toJSON()).toBeNull();
  });
});
