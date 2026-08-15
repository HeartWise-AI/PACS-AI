import { Error } from '../api/dto';

export const POLICY_ACCEPTANCE_PATH = '/policies/accept';

interface PolicyAcceptanceAPIError {
  response?: {
    data?: {
      errorCode?: string;
    };
  };
}

interface BrowserLocation {
  pathname: string;
  search: string;
  hash: string;
}

interface PolicyAcceptanceRedirectOptions {
  location?: BrowserLocation;
  redirect?: (url: string) => void;
  storage?: Pick<Storage, 'getItem'>;
}

export const isSafeReturnPath = (value: string | null): value is string =>
  Boolean(
    value &&
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\') &&
      !Array.from(value).some(character => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 || codePoint === 127;
      })
  );

export const getPolicyAcceptanceURL = (returnTo = '/'): string => {
  const safeReturnTo = isSafeReturnPath(returnTo) ? returnTo : '/';
  const search = new URLSearchParams({ returnTo: safeReturnTo });
  return `${POLICY_ACCEPTANCE_PATH}?${search.toString()}`;
};

export const getPolicyAcceptanceReturnPath = (search: string): string => {
  const returnTo = new URLSearchParams(search).get('returnTo');
  if (!isSafeReturnPath(returnTo) || returnTo.startsWith(POLICY_ACCEPTANCE_PATH)) {
    return '/';
  }
  return returnTo;
};

export const handlePolicyAcceptanceRequiredError = (
  error: PolicyAcceptanceAPIError,
  options: PolicyAcceptanceRedirectOptions = {}
): boolean => {
  if (error?.response?.data?.errorCode !== Error.POLICY_ACCEPTANCE_REQUIRED) {
    return false;
  }

  const storage = options.storage ?? window.localStorage;
  // Public registration uses this domain error too. Only an authenticated
  // session belongs on the existing-user recovery route.
  if (!storage.getItem('sessionToken')) {
    return false;
  }

  const location = options.location ?? window.location;
  if (location.pathname === POLICY_ACCEPTANCE_PATH) {
    return true;
  }

  const redirect = options.redirect ?? (url => window.location.replace(url));
  redirect(getPolicyAcceptanceURL(`${location.pathname}${location.search}${location.hash}`));
  return true;
};
