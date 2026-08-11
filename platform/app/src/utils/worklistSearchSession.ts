export const WORKLIST_SEARCH_SESSION_STORAGE_KEY = 'pacs-ai.worklist.submitted-search.v1';

export const WORKLIST_SEARCH_FILTER_KEYS = [
  'modalityId',
  'accessionNumber',
  'institutionName',
  'modalitiesInStudy',
  'numberOfStudyRelatedSeries',
  'patientBirthDate',
  'patientId',
  'patientName',
  'patientSex',
  'referringPhysicianName',
  'requestingPhysician',
  'studyDate',
  'studyDescription',
  'studyId',
  'studyInstanceUID',
  'studyTime',
] as const;

export type WorklistSearchFilterKey = (typeof WORKLIST_SEARCH_FILTER_KEYS)[number];
export type WorklistSearchFilters = Record<WorklistSearchFilterKey, string>;

export interface SubmittedWorklistSearch {
  filters: WorklistSearchFilters;
  currentPage: number;
}

interface StoredWorklistSearch extends SubmittedWorklistSearch {
  version: 1;
  authenticatedIdentity: string;
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getSessionStorage(storage?: SessionStorage): SessionStorage | null {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isWorklistSearchFilters(value: unknown): value is WorklistSearchFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const filters = value as Record<string, unknown>;
  return WORKLIST_SEARCH_FILTER_KEYS.every(key => typeof filters[key] === 'string');
}

function parseStoredWorklistSearch(value: string): StoredWorklistSearch | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredWorklistSearch>;
    if (
      parsed.version !== 1 ||
      typeof parsed.authenticatedIdentity !== 'string' ||
      parsed.authenticatedIdentity.length === 0 ||
      !isWorklistSearchFilters(parsed.filters) ||
      !Number.isInteger(parsed.currentPage) ||
      Number(parsed.currentPage) < 1
    ) {
      return null;
    }

    return parsed as StoredWorklistSearch;
  } catch {
    return null;
  }
}

export function saveSubmittedWorklistSearch(
  authenticatedIdentity: string,
  submittedSearch: SubmittedWorklistSearch,
  storage?: SessionStorage
): void {
  const sessionStorage = getSessionStorage(storage);
  if (
    !sessionStorage ||
    !authenticatedIdentity ||
    !isWorklistSearchFilters(submittedSearch.filters)
  ) {
    return;
  }

  const storedSearch: StoredWorklistSearch = {
    version: 1,
    authenticatedIdentity,
    filters: submittedSearch.filters,
    currentPage: Math.max(1, Math.floor(submittedSearch.currentPage)),
  };

  try {
    sessionStorage.setItem(WORKLIST_SEARCH_SESSION_STORAGE_KEY, JSON.stringify(storedSearch));
  } catch {
    // Worklist search remains usable when browser storage is unavailable or full.
  }
}

export function loadSubmittedWorklistSearch(
  authenticatedIdentity: string,
  storage?: SessionStorage
): SubmittedWorklistSearch | null {
  const sessionStorage = getSessionStorage(storage);
  if (!sessionStorage || !authenticatedIdentity) {
    return null;
  }

  try {
    const rawSearch = sessionStorage.getItem(WORKLIST_SEARCH_SESSION_STORAGE_KEY);
    if (!rawSearch) {
      return null;
    }

    const storedSearch = parseStoredWorklistSearch(rawSearch);
    if (!storedSearch || storedSearch.authenticatedIdentity !== authenticatedIdentity) {
      sessionStorage.removeItem(WORKLIST_SEARCH_SESSION_STORAGE_KEY);
      return null;
    }

    return {
      filters: storedSearch.filters,
      currentPage: storedSearch.currentPage,
    };
  } catch {
    return null;
  }
}

export function clearSubmittedWorklistSearch(storage?: SessionStorage): void {
  const sessionStorage = getSessionStorage(storage);
  if (!sessionStorage) {
    return;
  }

  try {
    sessionStorage.removeItem(WORKLIST_SEARCH_SESSION_STORAGE_KEY);
  } catch {
    // Logout and tenant transitions must continue even when storage is unavailable.
  }
}
