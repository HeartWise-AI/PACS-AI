import inferenceRepository from '../api/inferenceRepository';
import type { GetInferenceAvailableModelsResponse } from '../api/inferenceDTO';
import createStore, { STATE_CHANGED } from './createStore';
import { pacsAiSessionService } from './PacsAiSessionService';
import { onAuthenticatedSessionCleared } from '../utils/authenticatedSession';

export interface AvailableModelsState {
  inferenceAvailableModels: GetInferenceAvailableModelsResponse[];
  fetchingAvailableModels: boolean;
  /** A background refresh (refreshAvailableModels) is in flight; the list stays shown. */
  refreshingAvailableModels: boolean;
}

const EMPTY_STATE: AvailableModelsState = Object.freeze({
  inferenceAvailableModels: [],
  fetchingAvailableModels: false,
  refreshingAvailableModels: false,
}) as AvailableModelsState;

/**
 * Identity of a model across loads. api-pacs lists only the model containers
 * that answer /model-info and /model-facts at that moment, so a container busy
 * with a prediction can be missing from one answer and back in the next.
 */
export function modelKey(model: any): string {
  return String(
    model?.containerID ??
      model?.containerId ??
      model?.containerName ??
      (model?.modelName ? `${model.modelName}@${model.version ?? ''}` : undefined) ??
      model?.id ??
      JSON.stringify(model)
  );
}

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

  private store = createStore<AvailableModelsState>({ ...EMPTY_STATE });

  private loadGeneration = 0;

  /**
   * Every model seen since the last reset, in the order first seen. A model
   * that drops out of one answer (busy container) stays offered for this
   * viewer: running it while busy queues or fails with a clear message, which
   * beats "No inference models found" on a study the model just processed.
   */
  private known = new Map<string, GetInferenceAvailableModelsResponse>();

  private refreshInFlight: Promise<GetInferenceAvailableModelsResponse[]> | null = null;

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
    this.syncSession();
    this.store.setState({ inferenceAvailableModels: [], fetchingAvailableModels: true });
    try {
      const response = await inferenceRepository.GetInferenceAvailableModels();
      if (generation === this.loadGeneration) {
        this.store.setState({ inferenceAvailableModels: this.merge(response.data) });
      }
      return response.data;
    } finally {
      if (generation === this.loadGeneration) {
        this.store.setState({ fetchingAvailableModels: false });
      }
    }
  };

  /**
   * Asks api-pacs again without emptying the list first, and adds what it
   * answers to the models already known. Used when the run-model menu opens,
   * so a model missing from the viewer's first load (its container was busy)
   * or a list emptied while the viewer stayed mounted comes back. Errors are
   * swallowed: the menu keeps what it has.
   */
  refreshAvailableModels = (): Promise<GetInferenceAvailableModelsResponse[]> => {
    if (this.store.getState().fetchingAvailableModels) {
      return Promise.resolve(this.getState().inferenceAvailableModels);
    }
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const generation = this.loadGeneration;
    this.syncSession();
    this.store.setState({ refreshingAvailableModels: true });
    this.refreshInFlight = Promise.resolve()
      .then(() => inferenceRepository.GetInferenceAvailableModels())
      .then(response => {
        if (generation === this.loadGeneration) {
          this.store.setState({ inferenceAvailableModels: this.merge(response.data) });
        }
        return this.getState().inferenceAvailableModels;
      })
      .catch(error => {
        console.warn('Refreshing the available inference models failed:', error);
        return this.getState().inferenceAvailableModels;
      })
      .finally(() => {
        this.refreshInFlight = null;
        this.store.setState({ refreshingAvailableModels: false });
      });
    return this.refreshInFlight;
  };

  /** Empties the list and discards any load in flight. */
  reset = (): void => {
    this.loadGeneration++;
    this.sessionKey = currentSessionKey();
    this.known.clear();
    this.store.setState({ ...EMPTY_STATE });
  };

  /** A list belongs to one session: a new token or tenant starts from nothing. */
  private syncSession(): void {
    const key = currentSessionKey();
    if (key !== this.sessionKey) {
      this.known.clear();
      this.sessionKey = key;
    }
  }

  private merge(
    models: GetInferenceAvailableModelsResponse[] | null | undefined
  ): GetInferenceAvailableModelsResponse[] {
    for (const model of models || []) {
      this.known.set(modelKey(model), model);
    }
    return Array.from(this.known.values());
  }

  /** Called by OHIF's ExtensionManager for every service when a mode exits. */
  onModeExit = (): void => this.reset();
}

export const pacsAiModelsService = new PacsAiModelsService();

// Logout and session expiry empty the list (and re-render its readers) at once.
onAuthenticatedSessionCleared(pacsAiModelsService.reset);
