import { Error } from '@pacs-ai/extension-core/src/api/dto';
import type { LoginAPIError } from '@pacs-ai/extension-core/src/api/loginAPIError';

type Translate = (key: string, values?: Record<string, unknown>) => string;

const challengeErrorCodes = new Set<string>([
  Error.LOGIN_CHALLENGE_REQUIRED,
  Error.TURNSTILE_INVALID,
  Error.LOGIN_RATE_LIMITED,
  Error.CLOUDFLARE_API_ERROR,
]);

/**
 * Formats a login wait as "45 s", "10 min" or "9 min 40 s" so long cooldowns are
 * not shown as hundreds of seconds.
 */
export const formatLoginWait = (totalSeconds: number, t: Translate): string => {
  const seconds = Math.max(Math.ceil(totalSeconds), 0);
  if (seconds < 60) {
    return t('{{seconds}} s', { seconds });
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (remainder === 0) {
    return t('{{minutes}} min', { minutes });
  }
  return t('{{minutes}} min {{seconds}} s', { minutes, seconds: remainder });
};

/** Whole minutes, rounded up, for "about N min" wording. */
export const loginWaitMinutes = (totalSeconds: number): number =>
  Math.max(Math.ceil(totalSeconds / 60), 1);

export const isLoginRateLimited = (failure: unknown): boolean => {
  const error = (failure || {}) as Partial<LoginAPIError>;
  return error.errorCode === Error.LOGIN_RATE_LIMITED || error.status === 429;
};

export const requiresLoginChallenge = (failure: unknown): boolean => {
  const error = (failure || {}) as Partial<LoginAPIError>;
  return error.challengeRequired === true || challengeErrorCodes.has(error.errorCode || '');
};

export const getLoginErrorMessage = (failure: unknown, t: Translate): string => {
  const error = (failure || {}) as Partial<LoginAPIError>;

  if (error.errorCode === Error.LOGIN_RATE_LIMITED || error.status === 429) {
    if (error.retryAfterSeconds && error.retryAfterSeconds > 0) {
      return t('Too many login attempts. Please wait {{duration}} before trying again.', {
        duration: formatLoginWait(error.retryAfterSeconds, t),
      });
    }
    return t('Too many login attempts. Please try again later.');
  }

  switch (error.errorCode) {
    case Error.LOGIN_CHALLENGE_REQUIRED:
      return t('Complete the login verification to continue.');
    case Error.TURNSTILE_INVALID:
      return t('Complete the login verification again before signing in.');
    case Error.CLOUDFLARE_API_ERROR:
      return t('Login verification is temporarily unavailable. Please try again.');
    case Error.LOGIN_PROTECTION_UNAVAILABLE:
    case Error.FIREBASE_AUTH_ERROR:
      return t('Login is temporarily unavailable. Please try again later.');
    case Error.FIREBASE_AUTH_EMAIL_NOT_VERIFIED:
      return t('Please verify your email before logging in.');
    case Error.ACCOUNT_SUSPENDED:
      return t('Your account access has been suspended. Contact your workspace administrator.');
    case Error.UNAUTHORIZED_ACCESS:
      return t('Invalid email or password');
    default:
      break;
  }

  if (!error.status) {
    return t('Unable to reach the login service. Check your connection and try again.');
  }
  if (error.status >= 500) {
    return t('Login is temporarily unavailable. Please try again later.');
  }
  return t('Invalid email or password');
};
