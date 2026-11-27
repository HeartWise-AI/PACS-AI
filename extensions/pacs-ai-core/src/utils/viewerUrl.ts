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

type Filters = Record<string, string | undefined | null>;

function studyParams(studyInstanceUIDs: string | readonly string[], filters: Filters = {}): string {
  const uids = (typeof studyInstanceUIDs === 'string' ? [studyInstanceUIDs] : studyInstanceUIDs)
    .map(uid => uid.trim())
    .filter(Boolean);
  // One parameter, comma-separated, as OHIF's DICOMweb data source reads it.
  return viewerSearchForStudy(uids.join(','), filters);
}

/**
 * The link that opens a study from anywhere in PACS-AI (notifications, AI
 * Predictions, feedback tabs, sign-in handoff): `/open-study?StudyInstanceUIDs=…`.
 * Only the study UIDs and non-identifying filters go in the URL.
 */
export function studyOpenPath(studyInstanceUIDs: string | readonly string[], filters: Filters = {}): string {
  return `${OPEN_STUDY_PATH}?${studyParams(studyInstanceUIDs, filters)}`;
}

/** The viewer page itself, once the studies are in the local store. */
export function viewerPathForStudy(
  studyInstanceUIDs: string | readonly string[],
  filters: Filters = {}
): string {
  return `/viewer?${studyParams(studyInstanceUIDs, filters)}`;
}

const DICOM_UID = /^[0-9.]{1,64}$/;

/**
 * Every study UID of a viewer or open-study query string (repeated and
 * comma-separated `StudyInstanceUIDs`, as OHIF reads them), in order, without
 * duplicates. Null when there is none or one is not a DICOM UID.
 */
export function studyInstanceUIDsFromSearch(search: string | URLSearchParams): string[] | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const uids = params
    .getAll('StudyInstanceUIDs')
    .concat(params.getAll('studyInstanceUIDs'))
    .flatMap(value => value.split(','))
    .map(uid => uid.trim())
    .filter(Boolean);
  if (!uids.length || !uids.every(uid => DICOM_UID.test(uid))) {
    return null;
  }
  return uids.filter((uid, index) => uids.indexOf(uid) === index);
}

/**
 * The query string of the viewer (or of /open-study) for these studies with
 * the other parameters of a link kept, patient identifiers dropped: viewer
 * options such as initialSeriesInstanceUID, initialSOPInstanceUID or
 * hangingprotocolId still apply.
 */
export function studySearchKeepingOptions(
  studyInstanceUIDs: readonly string[],
  search: string | URLSearchParams
): string {
  const kept = withoutPatientIdentifiers(search);
  kept.delete('StudyInstanceUIDs');
  kept.delete('studyInstanceUIDs');
  const params = new URLSearchParams({ StudyInstanceUIDs: studyInstanceUIDs.join(',') });
  kept.forEach((value, key) => params.append(key, value));
  return params.toString();
}

/**
 * A return path such as the sign-in handoff's `/viewer?StudyInstanceUIDs=…`
 * as the open-study link (patient identifiers dropped, viewer options kept);
 * other paths unchanged.
 */
export function toStudyOpenPath(path: string): string {
  const [pathname, search = ''] = path.split('?', 2);
  if (pathname !== '/viewer' && pathname !== '/viewer/') {
    return path;
  }
  const uids = studyInstanceUIDsFromSearch(search);
  if (!uids) {
    return path;
  }
  return `${OPEN_STUDY_PATH}?${studySearchKeepingOptions(uids, search)}`;
}

// --- links that reach /viewer directly (bookmarks, history, old links) ------

/**
 * The studies the last study route was asked for, so that the "not available"
 * page can try the retrieve once (OHIF sends it there without the UIDs).
 */
export const VIEWER_REQUEST_STORAGE_KEY = 'pacsai.viewerStudyRequest';
const VIEWER_RETRIEVE_ATTEMPTS_KEY = 'pacsai.viewerStudyRetrieveAttempts';
// A request older than this is not the one the "not available" page is about.
export const VIEWER_REQUEST_MAX_AGE_MS = 2 * 60_000;
// The retrieve is tried at most once per selection in this window (no loop).
export const VIEWER_RETRIEVE_RETRY_WINDOW_MS = 10 * 60_000;

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;

function sessionStore(): SessionStore | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

const attemptKey = (uids: readonly string[]) => uids.join(',');

/**
 * Records the studies of a route that opens studies. Only `/viewer` requests
 * can be recovered; any other study route (e.g. `/segmentation`) replaces the
 * record with one that cannot, so the "not available" page never opens a
 * study other than the one that failed.
 */
export function recordViewerStudyRequest(
  pathname: string,
  search: string,
  { storage = sessionStore(), now = Date.now } = {}
): void {
  if (!storage || pathname === '/notfoundstudy' || pathname === OPEN_STUDY_PATH) {
    return;
  }
  const params = new URLSearchParams(search);
  if (!params.has('StudyInstanceUIDs') && !params.has('studyInstanceUIDs')) {
    return;
  }
  const uids = /^\/viewer\/?$/.test(pathname) ? studyInstanceUIDsFromSearch(params) : null;
  try {
    storage.setItem(VIEWER_REQUEST_STORAGE_KEY, JSON.stringify({ uids, at: now() }));
  } catch {
    // Without storage the "not available" page shows its message as before.
  }
}

function readAttempts(storage: SessionStore, now: () => number): Record<string, number> {
  try {
    const parsed = JSON.parse(storage.getItem(VIEWER_RETRIEVE_ATTEMPTS_KEY) || '{}');
    return Object.fromEntries(
      Object.entries(parsed && typeof parsed === 'object' ? parsed : {}).filter(
        ([, at]) => typeof at === 'number' && now() - at < VIEWER_RETRIEVE_RETRY_WINDOW_MS
      )
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * The studies the "not available" page should retrieve, once: those of the
 * last `/viewer` request if it is recent and was not retried lately. Marks
 * them as retried.
 */
export function takeViewerStudyToRetrieve({
  storage = sessionStore(),
  now = Date.now,
}: { storage?: SessionStore | null; now?: () => number } = {}): string[] | null {
  if (!storage) {
    return null;
  }
  try {
    const request = JSON.parse(storage.getItem(VIEWER_REQUEST_STORAGE_KEY) || 'null');
    const uids: unknown = request?.uids;
    if (
      !Array.isArray(uids) ||
      !uids.length ||
      !uids.every(uid => typeof uid === 'string' && DICOM_UID.test(uid)) ||
      typeof request.at !== 'number' ||
      now() - request.at > VIEWER_REQUEST_MAX_AGE_MS
    ) {
      return null;
    }
    const attempts = readAttempts(storage, now);
    const key = attemptKey(uids);
    if (key in attempts) {
      return null;
    }
    attempts[key] = now();
    storage.setItem(VIEWER_RETRIEVE_ATTEMPTS_KEY, JSON.stringify(attempts));
    return uids as string[];
  } catch {
    return null;
  }
}

/** Marks studies as just retrieved by /open-study (the viewer gets no second try). */
export function markViewerStudyRetrieved(
  studyInstanceUIDs: readonly string[],
  { storage = sessionStore(), now = Date.now } = {}
): void {
  if (!storage || !studyInstanceUIDs.length) {
    return;
  }
  try {
    const attempts = readAttempts(storage, now);
    attempts[attemptKey(studyInstanceUIDs)] = now();
    storage.setItem(VIEWER_RETRIEVE_ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // ignore
  }
}

let viewerRequestTrackingInstalled = false;

/** The browser path relative to the router basename (window.config.routerBasename). */
export function routerPathname(pathname: string, win: Window = window): string {
  const basename = String(
    ((win as unknown as { config?: { routerBasename?: string } }).config?.routerBasename) || ''
  ).replace(/\/$/, '');
  if (basename && (pathname === basename || pathname.startsWith(`${basename}/`))) {
    return pathname.slice(basename.length) || '/';
  }
  return pathname;
}

/**
 * Follows navigation (popstate and React Router's pushState/replaceState,
 * see hooks/usePathname) and records each study route request.
 */
export function installViewerStudyRequestTracking(win: Window = window): void {
  if (viewerRequestTrackingInstalled || typeof win === 'undefined') {
    return;
  }
  viewerRequestTrackingInstalled = true;
  installLocationChangeEvents();
  const record = () =>
    recordViewerStudyRequest(routerPathname(win.location.pathname, win), win.location.search);
  win.addEventListener('popstate', record);
  win.addEventListener(LOCATION_CHANGE_EVENT, record);
  record();
}
