import {
  clearSubmittedWorklistSearch,
  createWorklistSearchFilters,
  loadSubmittedWorklistSearch,
  saveSubmittedWorklistSearch,
  updateSubmittedWorklistSearchPage,
  WORKLIST_SEARCH_SESSION_STORAGE_KEY,
  type WorklistSearchFilters,
} from './worklistSearchSession';

function createFilters(overrides: Partial<WorklistSearchFilters> = {}): WorklistSearchFilters {
  return createWorklistSearchFilters({
    studyDate: '20260801-20260811',
    modalitiesInStudy: 'XA',
    modalityId: 'ORTHANC-A',
    ...overrides,
  });
}

describe('worklist search session', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('restores the last submitted search for the same authenticated identity', () => {
    const submittedSearch = {
      filters: createFilters({ patientName: 'DOE^JANE' }),
      currentPage: 3,
    };

    saveSubmittedWorklistSearch('tenant-a:user-a', submittedSearch);

    expect(loadSubmittedWorklistSearch('tenant-a:user-a')).toEqual(submittedSearch);
  });

  it('does not restore search criteria for another authenticated identity', () => {
    saveSubmittedWorklistSearch('tenant-a:user-a', {
      filters: createFilters({ patientId: 'private-patient-id' }),
      currentPage: 1,
    });

    expect(loadSubmittedWorklistSearch('tenant-b:user-b')).toBeNull();
    expect(sessionStorage.getItem(WORKLIST_SEARCH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it.each([
    'not-json',
    JSON.stringify({ version: 2 }),
    JSON.stringify({
      version: 1,
      authenticatedIdentity: 'tenant-a:user-a',
      filters: { modalityId: 'ORTHANC-A' },
      currentPage: 1,
    }),
    JSON.stringify({
      version: 1,
      authenticatedIdentity: 'tenant-a:user-a',
      filters: createFilters(),
      currentPage: 0,
    }),
  ])('rejects and removes malformed persisted state', malformedState => {
    sessionStorage.setItem(WORKLIST_SEARCH_SESSION_STORAGE_KEY, malformedState);

    expect(loadSubmittedWorklistSearch('tenant-a:user-a')).toBeNull();
    expect(sessionStorage.getItem(WORKLIST_SEARCH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('clears the submitted search explicitly', () => {
    saveSubmittedWorklistSearch('tenant-a:user-a', {
      filters: createFilters(),
      currentPage: 1,
    });

    clearSubmittedWorklistSearch();

    expect(loadSubmittedWorklistSearch('tenant-a:user-a')).toBeNull();
  });

  it('updates only the page of an existing submitted search', () => {
    const filters = createFilters({ patientName: 'DOE^JANE' });
    saveSubmittedWorklistSearch('tenant-a:user-a', { filters, currentPage: 1 });

    updateSubmittedWorklistSearchPage('tenant-a:user-a', 4);

    expect(loadSubmittedWorklistSearch('tenant-a:user-a')).toEqual({
      filters,
      currentPage: 4,
    });
  });

  it('does not create persisted criteria from pagination alone', () => {
    updateSubmittedWorklistSearchPage('tenant-a:user-a', 2);

    expect(loadSubmittedWorklistSearch('tenant-a:user-a')).toBeNull();
  });

  it('fails safely when session storage is unavailable', () => {
    const unavailableStorage = {
      getItem: jest.fn(() => {
        throw new Error('blocked');
      }),
      setItem: jest.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: jest.fn(() => {
        throw new Error('blocked');
      }),
    };

    expect(() =>
      saveSubmittedWorklistSearch(
        'tenant-a:user-a',
        { filters: createFilters(), currentPage: 1 },
        unavailableStorage
      )
    ).not.toThrow();
    expect(loadSubmittedWorklistSearch('tenant-a:user-a', unavailableStorage)).toBeNull();
    expect(() => clearSubmittedWorklistSearch(unavailableStorage)).not.toThrow();
  });
});
