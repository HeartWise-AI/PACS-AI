import { act, renderHook } from '@testing-library/react';
import PacsAiStudyContextService, {
  initialStudyContextState,
  pacsAiStudyContextService,
} from './PacsAiStudyContextService';
import useStudyContext from '../hooks/useStudyContext';

describe('pacsAiStudyContextService', () => {
  afterEach(() => pacsAiStudyContextService.reset());

  test('registers as an OHIF service returning the shared instance', () => {
    expect(PacsAiStudyContextService.REGISTRATION.name).toBe('pacsAiStudyContextService');
    expect(PacsAiStudyContextService.REGISTRATION.create()).toBe(pacsAiStudyContextService);
  });

  test('stores the study context and notifies subscribers only on change', () => {
    const listener = jest.fn();
    const { unsubscribe } = pacsAiStudyContextService.subscribe(
      PacsAiStudyContextService.EVENTS.STATE_CHANGED,
      listener
    );
    const selectedModalities = { 'study-1': { modality: 'XA', displaySets: [] } };

    pacsAiStudyContextService.setSelectedModalities(selectedModalities);
    pacsAiStudyContextService.setSelectedModalities(selectedModalities);
    pacsAiStudyContextService.setPatientInfo({ PatientID: 'P1', PatientName: 'Doe^J' });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(pacsAiStudyContextService.getState()).toEqual({
      ...initialStudyContextState,
      selectedModalities,
      patientInfo: { PatientID: 'P1', PatientName: 'Doe^J' },
    });
    unsubscribe();
    pacsAiStudyContextService.setModalitiesInStudy('US');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('useStudyContext re-renders on change and keeps stable setters', () => {
    const { result } = renderHook(() => useStudyContext());
    const { setSelectedModalities } = result.current;
    expect(result.current.selectedModalities).toEqual({});

    act(() => setSelectedModalities({ 'study-2': { modality: 'US', displaySets: [] } }));

    expect(result.current.selectedModalities).toEqual({
      'study-2': { modality: 'US', displaySets: [] },
    });
    expect(result.current.setSelectedModalities).toBe(setSelectedModalities);
  });
});
