import { installLocationChangeEvents, LOCATION_CHANGE_EVENT } from '../hooks/usePathname';

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

// --- opening a study ------------------------------------------------------------

/**
 * The page every "open this study" link goes to. It gets the study into the
 * local store first, as the work list does (the store keeps a study about 24
 * hours; after that it must be retrieved from the hospital PACS again), then
 * replaces itself with the viewer. Going through it also remounts the viewer
 * when the link is followed from inside the viewer.
 */
export const OPEN_STUDY_PATH = '/open-study';

const STUDY_UIDS_KEY = 'StudyInstanceUIDs';

function studyParams(
  studyInstanceUID: string,
  filters: Record<string, string | undefined | null> = {}
): string {
  return viewerSearchForStudy(studyInstanceUID.trim(), filters);
}

/**
 * The link that opens a study from anywhere in PACS-AI (notifications, AI
 * Predictions, feedback tabs, sign-in handoff): `/open-study?StudyInstanceUIDs=…`.
 * Only the study UID and non-identifying filters go in the URL.
 */
export function studyOpenPath(
  studyInstanceUID: string,
  filters: Record<string, string | undefined | null> = {}
): string {
  return `${OPEN_STUDY_PATH}?${studyParams(studyInstanceUID, filters)}`;
}

/** The viewer page itself, once the study is in the local store. */
export function viewerPathForStudy(
  studyInstanceUID: string,
  filters: Record<string, string | undefined | null> = {}
): string {
  return `/viewer?${studyParams(studyInstanceUID, filters)}`;
}

/** The first study UID of a viewer or open-study query string, or null. */
export function studyInstanceUIDFromSearch(search: string | URLSearchParams): string | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  // OHIF accepts a comma-separated list; the open flow handles one study.
  const raw = params.get(STUDY_UIDS_KEY) ?? params.get('studyInstanceUIDs') ?? '';
  const first = raw.split(',')[0]?.trim() ?? '';
  return /^[0-9.]{1,64}$/.test(first) ? first : null;
}

/**
 * A return path such as the sign-in handoff's `/viewer?StudyInstanceUIDs=…`
 * as the open-study link (patient identifiers dropped); other paths unchanged.
 */
export function toStudyOpenPath(path: string): string {
  const [pathname, search = ''] = path.split('?', 2);
  if (pathname !== '/viewer' && pathname !== '/viewer/') {
    return path;
  }
  const uid = studyInstanceUIDFromSearch(search);
  if (!uid) {
    return path;
  }
  const params = new URLSearchParams(search);
  return studyOpenPath(uid, {
    modalitiesInStudy: params.get('modalitiesInStudy'),
    studyDate: params.get('studyDate'),
  });
}

// --- links that reach /viewer directly (bookmarks, history, old links) ------

/**
 * A study the viewer was asked for, so that the "not available" page can try
 * the retrieve once (OHIF sends it there without the UID).
 */
export const VIEWER_REQUEST_STORAGE_KEY = 'pacsai.viewerStudyRequest';
const VIEWER_RETRIEVE_ATTEMPTS_KEY = 'pacsai.viewerStudyRetrieveAttempts';
// A request older than this is not the one the "not available" page is about.
export const VIEWER_REQUEST_MAX_AGE_MS = 2 * 60_000;
// The retrieve is tried at most once per study in this window (no loop).
export const VIEWER_RETRIEVE_RETRY_WINDOW_MS = 10 * 60_000;

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;

function sessionStore(): SessionStore | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Records the study of a `/viewer` URL (no-op for other paths). */
export function recordViewerStudyRequest(
  pathname: string,
  search: string,
  { storage = sessionStore(), now = Date.now } = {}
): void {
  if (!storage || !/^\/viewer\/?$/.test(pathname)) {
    return;
  }
  const uid = studyInstanceUIDFromSearch(search);
  if (!uid) {
    return;
  }
  try {
    storage.setItem(VIEWER_REQUEST_STORAGE_KEY, JSON.stringify({ uid, at: now() }));
  } catch {
    // Without storage the "not available" page shows its message as before.
  }
}

/**
 * The study the "not available" page should retrieve, once: the last
 * `/viewer` request if it is recent and was not retried lately. Marks it
 * as retried.
 */
export function takeViewerStudyToRetrieve({
  storage = sessionStore(),
  now = Date.now,
}: { storage?: SessionStore | null; now?: () => number } = {}): string | null {
  if (!storage) {
    return null;
  }
  try {
    const request = JSON.parse(storage.getItem(VIEWER_REQUEST_STORAGE_KEY) || 'null');
    const uid = typeof request?.uid === 'string' ? request.uid : null;
    if (!uid || typeof request.at !== 'number' || now() - request.at > VIEWER_REQUEST_MAX_AGE_MS) {
      return null;
    }
    const attempts: Record<string, number> = JSON.parse(
      storage.getItem(VIEWER_RETRIEVE_ATTEMPTS_KEY) || '{}'
    );
    const last = attempts?.[uid];
    if (typeof last === 'number' && now() - last < VIEWER_RETRIEVE_RETRY_WINDOW_MS) {
      return null;
    }
    const kept = Object.fromEntries(
      Object.entries(attempts || {}).filter(
        ([, at]) => typeof at === 'number' && now() - at < VIEWER_RETRIEVE_RETRY_WINDOW_MS
      )
    );
    kept[uid] = now();
    storage.setItem(VIEWER_RETRIEVE_ATTEMPTS_KEY, JSON.stringify(kept));
    return uid;
  } catch {
    return null;
  }
}

/** Marks a study as just retrieved by /open-study (the viewer gets no second try). */
export function markViewerStudyRetrieved(
  studyInstanceUID: string,
  { storage = sessionStore(), now = Date.now } = {}
): void {
  if (!storage) {
    return;
  }
  try {
    const attempts = JSON.parse(storage.getItem(VIEWER_RETRIEVE_ATTEMPTS_KEY) || '{}') || {};
    attempts[studyInstanceUID] = now();
    storage.setItem(VIEWER_RETRIEVE_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // ignore
  }
}

let viewerRequestTrackingInstalled = false;

/**
 * Follows navigation (popstate and React Router's pushState/replaceState,
 * see hooks/usePathname) and records each `/viewer` study request.
 */
export function installViewerStudyRequestTracking(win: Window = window): void {
  if (viewerRequestTrackingInstalled || typeof win === 'undefined') {
    return;
  }
  viewerRequestTrackingInstalled = true;
  installLocationChangeEvents();
  const record = () => recordViewerStudyRequest(win.location.pathname, win.location.search);
  win.addEventListener('popstate', record);
  win.addEventListener(LOCATION_CHANGE_EVENT, record);
  record();
}
