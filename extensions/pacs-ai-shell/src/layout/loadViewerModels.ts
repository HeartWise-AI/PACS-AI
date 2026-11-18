import { pacsAiModelsService } from '@pacs-ai/extension-core/src/services/PacsAiModelsService';
import { Error as ApiError } from '@pacs-ai/extension-core/src/api/dto';
import type { ShowAlert } from '../alerts';

export const LOGOUT_DELAY_MS = 3000;

/**
 * Loads the models the viewer offers (read with useAvailableModels). When the
 * API says the session is not authorised, shows the message and signs the
 * user out after a short delay, as the fork's viewer layout meant to (it
 * called an undefined showAlert, so that path threw and never signed out).
 */
export async function loadViewerModels({
  showAlert,
  logout,
  models = pacsAiModelsService,
}: {
  showAlert?: ShowAlert;
  logout: () => void;
  models?: { loadAvailableModels: () => Promise<unknown> };
}): Promise<void> {
  try {
    await models.loadAvailableModels();
  } catch (error) {
    if (error?.errorCode === ApiError.UNAUTHORIZED_ACCESS) {
      showAlert?.(error.message, 'error');
      setTimeout(logout, LOGOUT_DELAY_MS);
    }
    console.error('Error fetching available inference models:', error);
  }
}
