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

  const empty = {
    inferenceAvailableModels: [],
    fetchingAvailableModels: false,
    refreshingAvailableModels: false,
  };

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
    expect(result.current).toEqual({ ...empty, fetchingAvailableModels: true });

    await act(() => load);
    expect(result.current).toEqual({ ...empty, inferenceAvailableModels: [{ id: 'model-1' }] });
  });

  test('starts from an empty list and rejects with the repository error', async () => {
    getModels.mockResolvedValueOnce({ data: [{ id: 'model-1' }] });
    await pacsAiModelsService.loadAvailableModels();

    const error = { errorCode: 'UNAUTHORIZED_ACCESS', message: 'no' };
    getModels.mockRejectedValueOnce(error);
    await expect(pacsAiModelsService.loadAvailableModels()).rejects.toBe(error);
    await waitFor(() =>
      expect(pacsAiModelsService.getState()).toEqual(empty)
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

  // api-pacs answers /model/proxy/available with only the model containers
  // that respond at that moment: one busy with a prediction drops out.
  describe('a model missing from one answer', () => {
    const jepa = { containerId: 'c-jepa', modelName: 'DeepCORO-JEPA', supportedDicomModalities: ['XA'] };
    const panEcho = { containerId: 'c-panecho', modelName: 'PanEcho', supportedDicomModalities: ['US'] };

    test('the refresh on menu open adds a model the viewer load missed', async () => {
      getModels.mockResolvedValueOnce({ data: [jepa] }).mockResolvedValueOnce({ data: [jepa, panEcho] });
      await pacsAiModelsService.loadAvailableModels();
      expect(pacsAiModelsService.getState().inferenceAvailableModels).toEqual([jepa]);

      const refresh = pacsAiModelsService.refreshAvailableModels();
      // The list stays shown while the refresh runs.
      expect(pacsAiModelsService.getState()).toEqual({
        ...empty,
        inferenceAvailableModels: [jepa],
        refreshingAvailableModels: true,
      });
      await refresh;
      expect(pacsAiModelsService.getState()).toEqual({ ...empty, inferenceAvailableModels: [jepa, panEcho] });
    });

    test('a model seen once stays offered when a later answer leaves it out', async () => {
      getModels.mockResolvedValueOnce({ data: [jepa, panEcho] }).mockResolvedValueOnce({ data: [jepa] });
      await pacsAiModelsService.loadAvailableModels();
      await pacsAiModelsService.refreshAvailableModels();
      expect(pacsAiModelsService.getState().inferenceAvailableModels).toEqual([jepa, panEcho]);
    });

    test('a failed refresh keeps the list', async () => {
      getModels.mockResolvedValueOnce({ data: [jepa] }).mockRejectedValueOnce(new Error('502'));
      await pacsAiModelsService.loadAvailableModels();
      await expect(pacsAiModelsService.refreshAvailableModels()).resolves.toEqual([jepa]);
      expect(pacsAiModelsService.getState()).toEqual({ ...empty, inferenceAvailableModels: [jepa] });
    });

    test('a refresh fills a list emptied while the viewer stayed mounted', async () => {
      getModels.mockResolvedValue({ data: [panEcho] });
      pacsAiModelsService.reset();
      await pacsAiModelsService.refreshAvailableModels();
      expect(pacsAiModelsService.getState().inferenceAvailableModels).toEqual([panEcho]);
    });

    test('concurrent opens share one request', async () => {
      getModels.mockResolvedValue({ data: [panEcho] });
      await Promise.all([
        pacsAiModelsService.refreshAvailableModels(),
        pacsAiModelsService.refreshAvailableModels(),
      ]);
      expect(getModels).toHaveBeenCalledTimes(1);
    });

    test('models known for one session are not offered to the next', async () => {
      localStorage.setItem('sessionToken', 'user-a');
      getModels.mockResolvedValueOnce({ data: [panEcho] }).mockResolvedValueOnce({ data: [jepa] });
      await pacsAiModelsService.loadAvailableModels();
      localStorage.setItem('sessionToken', 'user-b');
      await pacsAiModelsService.refreshAvailableModels();
      expect(pacsAiModelsService.getState().inferenceAvailableModels).toEqual([jepa]);
    });

    test('leaving the viewer forgets the known models', async () => {
      getModels.mockResolvedValueOnce({ data: [panEcho] }).mockResolvedValueOnce({ data: [jepa] });
      await pacsAiModelsService.loadAvailableModels();
      pacsAiModelsService.onModeExit();
      await pacsAiModelsService.loadAvailableModels();
      expect(pacsAiModelsService.getState().inferenceAvailableModels).toEqual([jepa]);
    });
  });
});
