import React from 'react';
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import GPUManagementPanel from './GPUManagementPanel';
import { useGPUInventory } from '../../hooks/useGPUInventory';
import userRepository from '@pacs-ai/extension-core/src/api/userRepository';
import type { UseInferenceModelsResult } from '../../hooks/useInferenceModels';
jest.mock('../../hooks/useGPUInventory');
jest.mock('@pacs-ai/extension-core/src/api/userRepository');
jest.mock('./ModelDeploymentProgressPanel', () => () => null);
const single = <T extends Element>(nodes: NodeListOf<T>): T => {
  expect(nodes).toHaveLength(1);
  return nodes[0];
};
// Button that has `text` as one of its direct text children.
const buttonWithChild = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find(node =>
    Array.from(node.childNodes).some(
      child => child.nodeType === Node.TEXT_NODE && child.textContent === text
    )
  )!;
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
  let renderer: RenderResult;
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
      renderer = render(
        <GPUManagementPanel
          active
          inference={inference}
        />
      );
    });
  };
  test('separates measured memory from reservations and labels missing telemetry', async () => {
    await mount();
    const text = renderer.container.innerHTML;
    expect(text).toContain('Device memory: ');
    expect(text).toContain('6,000 MiB');
    expect(text).toContain('Scheduler reserved: ');
    expect(text).toContain('9,000 MiB');
    expect(text).toContain('Device telemetry unavailable');
    expect(text).toContain('GPU-a');
    expect(text).toContain('GPU-b');
    expect(renderer.container.querySelectorAll('[role="progressbar"]')).toHaveLength(1);
  });
  test('requires confirmation then sends exact target and expected container identity', async () => {
    await mount();
    fireEvent.change(single(renderer.container.querySelectorAll('select')), {
      target: { value: 'GPU-b' },
    });
    const move = buttonWithChild(renderer.container, 'Move to GPU');
    fireEvent.click(move);
    expect(moveGPU).not.toHaveBeenCalled();
    expect(renderer.container.innerHTML).toContain('same model version');
    await act(async () => {
      fireEvent.click(buttonWithChild(renderer.container, 'Confirm GPU change'));
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
    expect(single(renderer.container.querySelectorAll('select')).disabled).toBe(true);
    expect(renderer.container.querySelectorAll('[role="progressbar"]')).toHaveLength(0);
    (userRepository.GetCurrentUser as jest.Mock).mockResolvedValue({ data: { role: 'USER' } });
    await act(async () =>
      renderer.rerender(
        <GPUManagementPanel
          active={false}
          inference={inference}
        />
      )
    );
    await act(async () =>
      renderer.rerender(
        <GPUManagementPanel
          active
          inference={inference}
        />
      )
    );
    expect(renderer.container.childNodes).toHaveLength(0);
  });
  test('rotating the session clears an open confirmation and selected target before reauthorization', async () => {
    await mount();
    fireEvent.change(single(renderer.container.querySelectorAll('select')), {
      target: { value: 'GPU-b' },
    });
    fireEvent.click(buttonWithChild(renderer.container, 'Move to GPU'));
    expect(
      renderer.container.querySelectorAll('[aria-label="Confirm GPU change"]')
    ).toHaveLength(1);
    await act(async () => {
      localStorage.setItem('sessionToken', 'token-b');
      window.dispatchEvent(new StorageEvent('storage', { key: 'sessionToken' }));
    });
    expect(
      renderer.container.querySelectorAll('[aria-label="Confirm GPU change"]')
    ).toHaveLength(0);
    expect(single(renderer.container.querySelectorAll('select')).value).toBe('GPU-a');
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
    expect(renderer.container.childNodes).toHaveLength(0);
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
    expect(renderer.container.childNodes).toHaveLength(0);
  });
});
