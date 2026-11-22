import { saveSubmittedWorklistSearch } from './worklistSearchSession';
import { clearAuthenticatedSession } from './authenticatedSession';

describe('authenticated session cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears authentication and submitted worklist search state', () => {
    localStorage.setItem('sessionToken', 'session-token');
    saveSubmittedWorklistSearch('tenant-a:user-a', {
      filters: {
        modalityId: 'ORTHANC-A',
        accessionNumber: '',
        institutionName: '',
        modalitiesInStudy: 'XA',
        numberOfStudyRelatedSeries: '',
        patientBirthDate: '',
        patientId: '',
        patientName: 'DOE^JANE',
        patientSex: '',
        referringPhysicianName: '',
        requestingPhysician: '',
        studyDate: '20260801-20260811',
        studyDescription: '',
        studyId: '',
        studyInstanceUID: '',
        studyTime: '',
      },
      currentPage: 2,
    });

    clearAuthenticatedSession();

    expect(localStorage.getItem('sessionToken')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
