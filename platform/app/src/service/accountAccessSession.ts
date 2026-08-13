export const ACCOUNT_SUSPENDED_ERROR_CODE = 'ACCOUNT_SUSPENDED';
export const ACCOUNT_SUSPENDED_REDIRECT_REASON = 'account_suspended';
export const ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY = 'accountSuspendedRedirectPending';

type AccountAccessStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export interface AccountSuspendedAPIError {
  response?: {
    data?: {
      errorCode?: string;
    };
  };
}

export interface AccountSuspendedRedirectOptions {
  storage?: AccountAccessStorage;
  redirect?: (url: string) => void;
}

export interface AccountSuspendedRedirectState {
  suspended: boolean;
  nextSearch: string;
}

export const getSuspendedAccountLoginURL = (tenantId?: string | null): string => {
  const search = new URLSearchParams();
  if (tenantId) {
    search.set('t', tenantId);
  }
  search.set('reason', ACCOUNT_SUSPENDED_REDIRECT_REASON);
  return `/login?${search.toString()}`;
};

export const consumeAccountSuspendedRedirect = (
  currentSearch: string,
  storage: Pick<Storage, 'removeItem'> = window.localStorage
): AccountSuspendedRedirectState => {
  const search = new URLSearchParams(currentSearch);
  const suspended = search.get('reason') === ACCOUNT_SUSPENDED_REDIRECT_REASON;
  if (suspended) {
    search.delete('reason');
    storage.removeItem(ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY);
  }
  const nextSearch = search.toString();
  return { suspended, nextSearch: nextSearch ? `?${nextSearch}` : '' };
};

export const getPendingAccountSuspendedLoginURL = (
  storage: Pick<Storage, 'getItem'> = window.localStorage
): string | null => {
  if (storage.getItem(ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY) !== 'true') {
    return null;
  }

  return getSuspendedAccountLoginURL(storage.getItem('tenantId'));
};

export const handleAccountSuspendedError = (
  error: AccountSuspendedAPIError,
  options: AccountSuspendedRedirectOptions = {}
): boolean => {
  if (error?.response?.data?.errorCode !== ACCOUNT_SUSPENDED_ERROR_CODE) {
    return false;
  }

  const storage = options.storage ?? window.localStorage;
  const redirect = options.redirect ?? (url => window.location.replace(url));
  const tenantId = storage.getItem('tenantId');

  storage.removeItem('sessionToken');
  storage.setItem(ACCOUNT_SUSPENDED_REDIRECT_PENDING_KEY, 'true');
  redirect(getSuspendedAccountLoginURL(tenantId));
  return true;
};
