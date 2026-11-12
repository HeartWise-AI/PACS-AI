import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import inferenceRepository from '../../../api/inferenceRepository';
import { useGPUInventory } from './useGPUInventory';
jest.mock('../../../api/inferenceRepository');
let result: ReturnType<typeof useGPUInventory>;
function Consumer({ enabled }: { enabled: boolean }) {
  result = useGPUInventory(enabled);
  return null;
}
const fetch = inferenceRepository.GetInferenceGPUs as jest.Mock;
const sample = {
  sampledAt: '2026-11-12T00:00:00Z',
  devices: [],
  models: [],
  managerEnabled: true,
  managerReady: true,
};
describe('GPU inventory polling', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fetch.mockResolvedValue({ data: sample });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    jest.useRealTimers();
  });
  test('polls only enabled visible panels and releases its timer on unmount', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<Consumer enabled={false} />);
    });
    expect(fetch).not.toHaveBeenCalled();
    await act(async () => {
      renderer.update(<Consumer enabled />);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(15000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.stale).toBe(true);
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    act(() => renderer.unmount());
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  test('aborts an in-flight request when its panel is removed', async () => {
    fetch.mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      renderer = TestRenderer.create(<Consumer enabled />);
    });
    const signal = fetch.mock.calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(false);
    act(() => renderer.unmount());
    expect(signal.aborted).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('clears protected inventory and stops polling after permission is revoked', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<Consumer enabled />);
    });
    fetch.mockRejectedValueOnce({ status: 403 });
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.inventory).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('retains a failed sample as stale rather than reporting zero memory', async () => {
    await act(async () => {
      renderer = TestRenderer.create(<Consumer enabled />);
    });
    fetch.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.inventory).toEqual(sample);
    expect(result.stale).toBe(true);
    expect(result.error).toBe(true);
    await act(async () => {
      renderer.update(<Consumer enabled={false} />);
    });
    expect(result.inventory).toBeNull();
  });
});
