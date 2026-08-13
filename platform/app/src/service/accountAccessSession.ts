export const ACCOUNT_SUSPENDED_ERROR_CODE = 'ACCOUNT_SUSPENDED';
export const ACCOUNT_SUSPENDED_REDIRECT_REASON = 'account_suspended';

export interface AccountSuspendedAPIError {
  response?: {
    data?: {
      errorCode?: string;
    };
  };
}

export interface AccountSuspendedRedirectOptions {
  storage?: Pick<Storage, 'getItem' | 'removeItem'>;
  redirect?: (url: string) => void;
}

export const getSuspendedAccountLoginURL = (tenantId?: string | null): string => {
  const search = new URLSearchParams();
  if (tenantId) {
    search.set('t', tenantId);
  }
  search.set('reason', ACCOUNT_SUSPENDED_REDIRECT_REASON);
  return `/login?${search.toString()}`;
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
  redirect(getSuspendedAccountLoginURL(tenantId));
  return true;
};
