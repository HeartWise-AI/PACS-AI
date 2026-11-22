jest.mock('@pacs-ai/extension-core/src/services/PacsAiModelsService', () => ({
  pacsAiModelsService: { loadAvailableModels: jest.fn() },
}));

import { Error as ApiError } from '@pacs-ai/extension-core/src/api/dto';
import { LOGOUT_DELAY_MS, loadViewerModels } from './loadViewerModels';

describe('loadViewerModels', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleError.mockRestore();
  });

  test('loads the models', async () => {
    const models = { loadAvailableModels: jest.fn().mockResolvedValue([]) };
    const showAlert = jest.fn();
    const logout = jest.fn();

    await loadViewerModels({ showAlert, logout, models });

    expect(models.loadAvailableModels).toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  test('shows the message and signs out when the session is not authorised', async () => {
    const models = {
      loadAvailableModels: jest
        .fn()
        .mockRejectedValue({ errorCode: ApiError.UNAUTHORIZED_ACCESS, message: 'Session expired' }),
    };
    const showAlert = jest.fn();
    const logout = jest.fn();

    await expect(loadViewerModels({ showAlert, logout, models })).resolves.toBeUndefined();

    expect(showAlert).toHaveBeenCalledWith('Session expired', 'error');
    expect(logout).not.toHaveBeenCalled();
    jest.advanceTimersByTime(LOGOUT_DELAY_MS);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  test('only logs other failures', async () => {
    const models = { loadAvailableModels: jest.fn().mockRejectedValue(new Error('network')) };
    const showAlert = jest.fn();
    const logout = jest.fn();

    await loadViewerModels({ showAlert, logout, models });
    jest.runAllTimers();

    expect(showAlert).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });
});
