import inferenceRepository from '../api/inferenceRepository';
import type { GetInferenceAvailableModelsResponse } from '../api/inferenceDTO';
import createStore, { STATE_CHANGED } from './createStore';
import { pacsAiSessionService } from './PacsAiSessionService';
import { onAuthenticatedSessionCleared } from '../utils/authenticatedSession';

export interface AvailableModelsState {
  inferenceAvailableModels: GetInferenceAvailableModelsResponse[];
  fetchingAvailableModels: boolean;
}

const EMPTY_STATE: AvailableModelsState = Object.freeze({
  inferenceAvailableModels: [],
  fetchingAvailableModels: false,
}) as AvailableModelsState;

/** The session a list belongs to: the user's token and tenant. */
function currentSessionKey(): string {
  return `${pacsAiSessionService.getSessionToken() || ''}|${pacsAiSessionService.getTenantId()}`;
}

/**
 * OHIF service `pacsAiModelsService`: the models the signed-in user may run
 * from the viewer. Replaces the AvailableModelsContext of the viewer layout.
 * The layout calls loadAvailableModels() when it mounts; React code reads the
 * list with useAvailableModels().
 *
 * The list never outlives its session or viewer: it reads as empty once the
 * session token or tenant differs from the one it was loaded for (logout,
 * expiry, another sign-in), and it is cleared when OHIF leaves the viewer
 * mode (onModeExit), so a remounted viewer shows no models until its own
 * load starts.
 */
export default class PacsAiModelsService {
  public static EVENTS = { STATE_CHANGED } as const;

  public static REGISTRATION = {
    name: 'pacsAiModelsService',
    altName: 'PacsAiModelsService',
    create: () => pacsAiModelsService,
  };

  private store = createStore<AvailableModelsState>({
    inferenceAvailableModels: [],
    fetchingAvailableModels: false,
  });

  private loadGeneration = 0;

  private sessionKey = currentSessionKey();

  getState = (): AvailableModelsState => {
    const state = this.store.getState();
    return this.sessionKey === currentSessionKey() ? state : EMPTY_STATE;
  };

  subscribe = this.store.subscribe;

  /**
   * Fetches the list again, starting from an empty list (as the viewer did
   * before). Rejects with the repository error so the caller can react to
   * UNAUTHORIZED_ACCESS; the list then stays empty.
   */
  loadAvailableModels = async (): Promise<GetInferenceAvailableModelsResponse[]> => {
    const generation = ++this.loadGeneration;
    this.sessionKey = currentSessionKey();
    this.store.setState({ inferenceAvailableModels: [], fetchingAvailableModels: true });
    try {
      const response = await inferenceRepository.GetInferenceAvailableModels();
      if (generation === this.loadGeneration) {
        this.store.setState({ inferenceAvailableModels: response.data });
      }
      return response.data;
    } finally {
      if (generation === this.loadGeneration) {
        this.store.setState({ fetchingAvailableModels: false });
      }
    }
  };

  /** Empties the list and discards any load in flight. */
  reset = (): void => {
    this.loadGeneration++;
    this.sessionKey = currentSessionKey();
    this.store.setState({ inferenceAvailableModels: [], fetchingAvailableModels: false });
  };

  /** Called by OHIF's ExtensionManager for every service when a mode exits. */
  onModeExit = (): void => this.reset();
}

export const pacsAiModelsService = new PacsAiModelsService();

// Logout and session expiry empty the list (and re-render its readers) at once.
onAuthenticatedSessionCleared(pacsAiModelsService.reset);
