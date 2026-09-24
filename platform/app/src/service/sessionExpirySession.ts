import { Error } from '../api/dto';
import { clearAuthenticatedSession } from '../utils/authenticatedSession';
import { isSafeReturnPath } from './policyAcceptanceSession';

export const SESSION_EXPIRED_REDIRECT_REASON = 'session_expired';
export const SESSION_EXPIRED_REDIRECT_PENDING_KEY = 'sessionExpiredRedirectPending';
export const SESSION_EXPIRED_RETURN_TO_KEY = 'sessionExpiredReturnTo';

const PUBLIC_AUTH_PATHS = new Set([
  '/v1/iam/login',
  '/v1/iam/forgot-password',
  '/v1/iam/verify-email',
  '/v1/user/register',
  '/v1/user/specialties',
  '/v1/user/policies/registration',
  '/v1/tenant/public',
]);

type SessionExpiryStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

interface SessionExpiryLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface SessionExpiredAPIError {
  config?: {
    url?: string;
  };
  response?: {
    status?: number;
    data?: {
      errorCode?: string;
    };
  };
}

export interface SessionExpiredRedirectOptions {
  location?: SessionExpiryLocation;
  redirect?: (url: string) => void;
  storage?: SessionExpiryStorage;
}

export interface SessionExpiredRedirectState {
  expired: boolean;
  nextSearch: string;
  returnTo: string;
}

const requestPath = (url?: string): string => {
  if (!url) {
    return '';
  }
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split(/[?#]/, 1)[0];
  }
};

export const isPublicAuthRequest = (url?: string): boolean =>
  PUBLIC_AUTH_PATHS.has(requestPath(url));

export const getSessionExpiredReturnPath = (search: string): string => {
  const returnTo = new URLSearchParams(search).get('returnTo');
  if (!isSafeReturnPath(returnTo) || returnTo.startsWith('/login')) {
    return '/';
  }
  return returnTo;
};

export const getSessionExpiredLoginURL = (tenantId?: string | null, returnTo = '/'): string => {
  const search = new URLSearchParams();
  if (tenantId) {
    search.set('t', tenantId);
  }
  search.set('reason', SESSION_EXPIRED_REDIRECT_REASON);
  if (isSafeReturnPath(returnTo) && !returnTo.startsWith('/login')) {
    search.set('returnTo', returnTo);
  }
  return `/login?${search.toString()}`;
};

export const consumeSessionExpiredRedirect = (
  currentSearch: string,
  storage: Pick<Storage, 'removeItem'> = window.localStorage
): SessionExpiredRedirectState => {
  const search = new URLSearchParams(currentSearch);
  const expired = search.get('reason') === SESSION_EXPIRED_REDIRECT_REASON;
  const returnTo = getSessionExpiredReturnPath(currentSearch);
  if (expired) {
    search.delete('reason');
  }
  storage.removeItem(SESSION_EXPIRED_REDIRECT_PENDING_KEY);
  storage.removeItem(SESSION_EXPIRED_RETURN_TO_KEY);
  const nextSearch = search.toString();
  return { expired, nextSearch: nextSearch ? `?${nextSearch}` : '', returnTo };
};

export const getPendingSessionExpiredLoginURL = (
  storage: Pick<Storage, 'getItem'> = window.localStorage
): string | null => {
  if (storage.getItem(SESSION_EXPIRED_REDIRECT_PENDING_KEY) !== 'true') {
    return null;
  }
  return getSessionExpiredLoginURL(
    storage.getItem('tenantId'),
    storage.getItem(SESSION_EXPIRED_RETURN_TO_KEY) || '/'
  );
};

export const handleSessionExpiredError = (
  error: SessionExpiredAPIError,
  options: SessionExpiredRedirectOptions = {}
): boolean => {
  if (
    error?.response?.status !== 401 ||
    error.response.data?.errorCode !== Error.UNAUTHORIZED_ACCESS ||
    isPublicAuthRequest(error.config?.url)
  ) {
    return false;
  }

  const storage = options.storage ?? window.localStorage;
  if (storage.getItem(SESSION_EXPIRED_REDIRECT_PENDING_KEY) === 'true') {
    return true;
  }
  if (!storage.getItem('sessionToken')) {
    return false;
  }

  const location = options.location ?? window.location;
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const returnTo =
    isSafeReturnPath(currentPath) && !currentPath.startsWith('/login') ? currentPath : '/';
  const tenantId = storage.getItem('tenantId');

  if (options.storage) {
    storage.removeItem('sessionToken');
  } else {
    clearAuthenticatedSession();
  }
  storage.setItem(SESSION_EXPIRED_REDIRECT_PENDING_KEY, 'true');
  storage.setItem(SESSION_EXPIRED_RETURN_TO_KEY, returnTo);

  const redirect = options.redirect ?? (url => window.location.replace(url));
  redirect(getSessionExpiredLoginURL(tenantId, returnTo));
  return true;
};
