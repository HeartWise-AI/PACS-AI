import createStore, { STATE_CHANGED } from './createStore';

export type SelectedModalities = { [key: string]: { modality: string; displaySets: any } };
export type PatientInfo = { PatientID: string; PatientName: string };

export interface StudyContextState {
  /** Per-study modalities and display sets offered to the model picker and chat. */
  selectedModalities: SelectedModalities;
  /** Patient shown in the viewer header (used by DICOM upload). */
  patientInfo: PatientInfo;
  /** Display sets of the study browser's active tab. */
  displaySets: any;
  /** Modalities of the last study item rendered by the study browser. */
  modalitiesInStudy: string;
}

export const initialStudyContextState: StudyContextState = {
  selectedModalities: {},
  patientInfo: { PatientID: '', PatientName: '' },
  displaySets: null,
  modalitiesInStudy: '',
};

/**
 * OHIF service `pacsAiStudyContextService`: what the viewer's study browser
 * and header know about the open study, for the model picker, the chat and
 * DICOM upload. Replaces GlobalStateProvider. React code uses
 * useStudyContext(); the setters are stable (bound once).
 */
export default class PacsAiStudyContextService {
  public static EVENTS = { STATE_CHANGED } as const;

  public static REGISTRATION = {
    name: 'pacsAiStudyContextService',
    altName: 'PacsAiStudyContextService',
    create: () => pacsAiStudyContextService,
  };

  private store = createStore<StudyContextState>(initialStudyContextState);

  getState = (): StudyContextState => this.store.getState();

  subscribe = this.store.subscribe;

  setSelectedModalities = (selectedModalities: SelectedModalities): void =>
    this.store.setState({ selectedModalities });

  setPatientInfo = (patientInfo: PatientInfo): void => this.store.setState({ patientInfo });

  setDisplaySets = (displaySets: any): void => this.store.setState({ displaySets });

  setModalitiesInStudy = (modalitiesInStudy: string): void =>
    this.store.setState({ modalitiesInStudy });

  reset = (): void => this.store.setState(initialStudyContextState);
}

export const pacsAiStudyContextService = new PacsAiStudyContextService();
