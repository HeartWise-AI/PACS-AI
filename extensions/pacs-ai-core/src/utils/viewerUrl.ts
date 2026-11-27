/**
 * Patient identifiers stay out of viewer URLs.
 *
 * The work list used to open the viewer with its whole search in the query
 * string (`/viewer?StudyInstanceUIDs=…&patientId=…&patientName=…`). From there
 * it reached browser history and, through the Referer, the backend nginx error
 * log on upstream errors. The viewer needs none of it: the study comes from
 * StudyInstanceUIDs, and prior studies are looked up with the PatientID from
 * the study's own DICOM metadata (QIDO). The work list restores its search from
 * session storage (worklistSearchSession).
 */

// Lower-case query keys that identify the patient (work list filter names and
// the OHIF study-list URL keys).
const PATIENT_IDENTIFIER_KEYS = new Set([
  'patientid',
  'patientname',
  'patientbirthdate',
  'patientsex',
  'mrn',
  'accessionnumber',
  'studyid',
  'referringphysicianname',
  'requestingphysician',
]);

// Work list filters still carried to the viewer: not identifying, and used by
// the guided tour (modalitiesInStudy) and the "Studies" link back.
const VIEWER_SEARCH_KEYS = ['modalitiesInStudy', 'studyDate'];

export function isPatientIdentifierParam(key: string): boolean {
  return PATIENT_IDENTIFIER_KEYS.has(key.toLowerCase());
}

/** The query string without patient identifiers (other parameters kept, in order). */
export function withoutPatientIdentifiers(search: string | URLSearchParams): URLSearchParams {
  const source = typeof search === 'string' ? new URLSearchParams(search) : search;
  const kept = new URLSearchParams();
  source.forEach((value, key) => {
    if (!isPatientIdentifierParam(key)) {
      kept.append(key, value);
    }
  });
  return kept;
}

/** Query string for opening a study from the work list: StudyInstanceUIDs plus non-identifying filters. */
export function viewerSearchForStudy(
  studyInstanceUID: string,
  filters: Record<string, string | undefined | null> = {}
): string {
  const params = new URLSearchParams({ StudyInstanceUIDs: studyInstanceUID });
  for (const key of VIEWER_SEARCH_KEYS) {
    const value = (filters[key] || '').replace(/\*/g, '');
    if (value) {
      params.set(key, value);
    }
  }
  return params.toString();
}

/**
 * Removes patient identifiers from the address bar (old links and bookmarks
 * that still carry them) without a navigation: the viewer ignores them anyway.
 * Returns true when the URL was changed.
 */
export function stripPatientIdentifiersFromAddressBar(win: Window = window): boolean {
  try {
    const { pathname, search, hash } = win.location;
    if (!search) {
      return false;
    }
    const params = new URLSearchParams(search);
    if (![...params.keys()].some(isPatientIdentifierParam)) {
      return false;
    }
    const kept = withoutPatientIdentifiers(params).toString();
    win.history.replaceState(win.history.state, '', `${pathname}${kept ? `?${kept}` : ''}${hash}`);
    return true;
  } catch {
    return false;
  }
}
