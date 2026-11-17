import inferenceRepository from '../api/inferenceRepository';
import type { GetInferenceAvailableModelsResponse } from '../api/inferenceDTO';
import createStore, { STATE_CHANGED } from './createStore';

export interface AvailableModelsState {
  inferenceAvailableModels: GetInferenceAvailableModelsResponse[];
  fetchingAvailableModels: boolean;
}

/**
 * OHIF service `pacsAiModelsService`: the models the signed-in user may run
 * from the viewer. Replaces the AvailableModelsContext of the viewer layout.
 * The layout calls loadAvailableModels() when it mounts; React code reads the
 * list with useAvailableModels().
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

  getState = (): AvailableModelsState => this.store.getState();

  subscribe = this.store.subscribe;

  /**
   * Fetches the list again, starting from an empty list (as the viewer did
   * before). Rejects with the repository error so the caller can react to
   * UNAUTHORIZED_ACCESS; the list then stays empty.
   */
  loadAvailableModels = async (): Promise<GetInferenceAvailableModelsResponse[]> => {
    const generation = ++this.loadGeneration;
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
}

export const pacsAiModelsService = new PacsAiModelsService();
