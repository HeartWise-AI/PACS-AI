import { Error } from '../../api/dto';
import type { LoginAPIError } from '../../api/loginAPIError';

type Translate = (key: string, values?: Record<string, unknown>) => string;

const challengeErrorCodes = new Set<string>([
  Error.LOGIN_CHALLENGE_REQUIRED,
  Error.TURNSTILE_INVALID,
  Error.LOGIN_RATE_LIMITED,
  Error.CLOUDFLARE_API_ERROR,
]);

export const requiresLoginChallenge = (failure: unknown): boolean => {
  const error = (failure || {}) as Partial<LoginAPIError>;
  return error.challengeRequired === true || challengeErrorCodes.has(error.errorCode || '');
};

export const getLoginErrorMessage = (failure: unknown, t: Translate): string => {
  const error = (failure || {}) as Partial<LoginAPIError>;

  if (error.errorCode === Error.LOGIN_RATE_LIMITED || error.status === 429) {
    if (error.retryAfterSeconds === 1) {
      return t('Too many login attempts. Please wait 1 second before trying again.');
    }
    if (error.retryAfterSeconds && error.retryAfterSeconds > 1) {
      return t('Too many login attempts. Please wait {{seconds}} seconds before trying again.', {
        seconds: error.retryAfterSeconds,
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
