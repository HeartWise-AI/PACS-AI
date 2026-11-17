import { act, renderHook, waitFor } from '@testing-library/react';
import inferenceRepository from '../api/inferenceRepository';
import PacsAiModelsService, { pacsAiModelsService } from './PacsAiModelsService';
import useAvailableModels from '../hooks/useAvailableModels';

jest.mock('../api/inferenceRepository', () => ({
  __esModule: true,
  default: { GetInferenceAvailableModels: jest.fn() },
}));

const getModels = inferenceRepository.GetInferenceAvailableModels as jest.Mock;

describe('pacsAiModelsService', () => {
  beforeEach(() => getModels.mockReset());

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
});
