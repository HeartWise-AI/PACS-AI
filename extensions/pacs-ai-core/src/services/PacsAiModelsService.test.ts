import { act, renderHook, waitFor } from '@testing-library/react';
import inferenceRepository from '../api/inferenceRepository';
import PacsAiModelsService, { pacsAiModelsService } from './PacsAiModelsService';
import useAvailableModels from '../hooks/useAvailableModels';
import { clearAuthenticatedSession } from '../utils/authenticatedSession';

jest.mock('../api/inferenceRepository', () => ({
  __esModule: true,
  default: { GetInferenceAvailableModels: jest.fn() },
}));

const getModels = inferenceRepository.GetInferenceAvailableModels as jest.Mock;

describe('pacsAiModelsService', () => {
  beforeEach(() => {
    getModels.mockReset();
    localStorage.clear();
    pacsAiModelsService.reset();
  });

  const empty = { inferenceAvailableModels: [], fetchingAvailableModels: false };

  test('registers as an OHIF service returning the shared instance', () => {
    expect(PacsAiModelsService.REGISTRATION.name).toBe('pacsAiModelsService');
    expect(PacsAiModelsService.REGISTRATION.create()).toBe(pacsAiModelsService);
  });

  test('loads the available models and exposes them through useAvailableModels', async () => {
    getModels.mockResolvedValue({ data: [{ id: 'model-1' }] });
    const { result } = renderHook(() => useAvailableModels());

    let load: Promise<unknown>;
    act(() => {
      load = pacsAiModelsService.loadAvailableModels();
    });
    expect(result.current).toEqual({ inferenceAvailableModels: [], fetchingAvailableModels: true });

    await act(() => load);
    expect(result.current).toEqual({
      inferenceAvailableModels: [{ id: 'model-1' }],
      fetchingAvailableModels: false,
    });
  });

  test('starts from an empty list and rejects with the repository error', async () => {
    getModels.mockResolvedValueOnce({ data: [{ id: 'model-1' }] });
    await pacsAiModelsService.loadAvailableModels();

    const error = { errorCode: 'UNAUTHORIZED_ACCESS', message: 'no' };
    getModels.mockRejectedValueOnce(error);
    await expect(pacsAiModelsService.loadAvailableModels()).rejects.toBe(error);
    await waitFor(() =>
      expect(pacsAiModelsService.getState()).toEqual({
        inferenceAvailableModels: [],
        fetchingAvailableModels: false,
      })
    );
  });

  test('keeps the result of the latest load only', async () => {
    let resolveFirst: (value: unknown) => void;
    getModels
      .mockReturnValueOnce(new Promise(resolve => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ data: [{ id: 'second' }] });

    const first = pacsAiModelsService.loadAvailableModels();
    await pacsAiModelsService.loadAvailableModels();
    resolveFirst({ data: [{ id: 'first' }] });
    await first;

    expect(pacsAiModelsService.getState().inferenceAvailableModels).toEqual([{ id: 'second' }]);
  });

  test('logout empties the list and re-renders its readers', async () => {
    localStorage.setItem('sessionToken', 'user-a');
    getModels.mockResolvedValue({ data: [{ id: 'tenant-a-model' }] });
    const { result } = renderHook(() => useAvailableModels());
    await act(() => pacsAiModelsService.loadAvailableModels());
    expect(result.current.inferenceAvailableModels).toEqual([{ id: 'tenant-a-model' }]);

    act(() => clearAuthenticatedSession());
    expect(result.current).toEqual(empty);
  });

  test('a list loaded for another session or tenant reads as empty', async () => {
    localStorage.setItem('sessionToken', 'user-a');
    localStorage.setItem('tenantId', 'tenant-a');
    getModels.mockResolvedValue({ data: [{ id: 'tenant-a-model' }] });
    await pacsAiModelsService.loadAvailableModels();
    expect(pacsAiModelsService.getState().inferenceAvailableModels).toHaveLength(1);

    // Token removed or replaced without clearAuthenticatedSession (expiry, another sign-in).
    localStorage.setItem('tenantId', 'tenant-b');
    expect(pacsAiModelsService.getState()).toEqual(empty);
    localStorage.setItem('tenantId', 'tenant-a');
    localStorage.setItem('sessionToken', 'user-b');
    expect(pacsAiModelsService.getState()).toEqual(empty);
    localStorage.removeItem('sessionToken');
    expect(pacsAiModelsService.getState()).toEqual(empty);
  });

  test('leaving the viewer mode empties the list so a remounted viewer starts empty', async () => {
    getModels.mockResolvedValue({ data: [{ id: 'previous-viewer-model' }] });
    await pacsAiModelsService.loadAvailableModels();

    pacsAiModelsService.onModeExit();

    // Next viewer mount, first render: before its own load starts.
    const { result } = renderHook(() => useAvailableModels());
    expect(result.current).toEqual(empty);
  });

  test('a load in flight when the mode exits does not land', async () => {
    let resolveLoad: (value: unknown) => void;
    getModels.mockReturnValueOnce(new Promise(resolve => (resolveLoad = resolve)));
    const load = pacsAiModelsService.loadAvailableModels();

    pacsAiModelsService.onModeExit();
    resolveLoad({ data: [{ id: 'late' }] });
    await load;

    expect(pacsAiModelsService.getState()).toEqual(empty);
  });
});
