import { patientSexFromDisplaySets } from './patientSex';

describe('patientSexFromDisplaySets', () => {
  it('reads PatientSex of the study from its display sets', () => {
    const sets = [
      { StudyInstanceUID: 'other', instances: [{ PatientSex: 'F' }] },
      { StudyInstanceUID: 'study', instances: [{ PatientSex: '' }, { PatientSex: 'm' }] },
    ];
    expect(patientSexFromDisplaySets(sets, 'study')).toBe('M');
    expect(patientSexFromDisplaySets([{ StudyInstanceUID: 'study', instance: { PatientSex: 'F' } }], 'study')).toBe('F');
  });

  it('is null when unknown or not loaded', () => {
    expect(patientSexFromDisplaySets([], 'study')).toBeNull();
    expect(patientSexFromDisplaySets([{ StudyInstanceUID: 'study', instances: [{ PatientSex: 'O' }] }], 'study')).toBeNull();
  });
});
