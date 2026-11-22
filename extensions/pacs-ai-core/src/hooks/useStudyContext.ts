import { useSyncExternalStore } from 'react';
import { pacsAiStudyContextService } from '../services/PacsAiStudyContextService';
import { STATE_CHANGED } from '../services/createStore';

const subscribe = (onChange: () => void) =>
  pacsAiStudyContextService.subscribe(STATE_CHANGED, onChange).unsubscribe;

/**
 * Study context of the open viewer (pacsAiStudyContextService) with its
 * setters; re-renders when it changes. Replaces useGlobalStateData.
 */
export default function useStudyContext() {
  const state = useSyncExternalStore(
    subscribe,
    pacsAiStudyContextService.getState,
    pacsAiStudyContextService.getState
  );
  return {
    ...state,
    setSelectedModalities: pacsAiStudyContextService.setSelectedModalities,
    setPatientInfo: pacsAiStudyContextService.setPatientInfo,
    setDisplaySets: pacsAiStudyContextService.setDisplaySets,
    setModalitiesInStudy: pacsAiStudyContextService.setModalitiesInStudy,
  };
}
