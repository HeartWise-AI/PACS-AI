import { useSyncExternalStore } from 'react';
import { pacsAiModelsService } from '../services/PacsAiModelsService';
import type { AvailableModelsState } from '../services/PacsAiModelsService';
import { STATE_CHANGED } from '../services/createStore';

const subscribe = (onChange: () => void) =>
  pacsAiModelsService.subscribe(STATE_CHANGED, onChange).unsubscribe;

/**
 * Models the user may run from the viewer (pacsAiModelsService). Replaces
 * useContext(AvailableModelsContext).
 */
export default function useAvailableModels(): AvailableModelsState {
  return useSyncExternalStore(subscribe, pacsAiModelsService.getState, pacsAiModelsService.getState);
}
