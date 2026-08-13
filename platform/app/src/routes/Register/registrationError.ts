import { Error } from '../../api/dto';
import type { RegistrationAPIError } from '../../api/registrationAPIError';

type Translate = (key: string, values?: Record<string, unknown>) => string;

const genericDuplicateMessage =
  'Registration could not be completed. Try signing in or resetting your password, or use different details.';

export const getRegistrationErrorMessage = (failure: unknown, t: Translate): string => {
  const error = (failure || {}) as Partial<RegistrationAPIError>;

  if (error.errorCode === Error.REGISTRATION_RATE_LIMITED || error.status === 429) {
    if (error.retryAfterSeconds === 1) {
      return t('Too many registration attempts. Please wait 1 second before trying again.');
    }
    if (error.retryAfterSeconds && error.retryAfterSeconds > 1) {
      return t(
        'Too many registration attempts. Please wait {{seconds}} seconds before trying again.',
        { seconds: error.retryAfterSeconds }
      );
    }
    return t('Too many registration attempts. Please try again later.');
  }

  switch (error.errorCode) {
    case Error.TURNSTILE_INVALID:
      return t('Complete the verification again before registering.');
    case Error.CLOUDFLARE_API_ERROR:
      return t('Registration verification is temporarily unavailable. Please try again.');
    case Error.DUPLICATE_RECORD:
      return t(genericDuplicateMessage);
    case Error.INVALID_PAYLOAD:
      return error.message || t('Please review your registration details and try again.');
    case Error.INVALID_REQUEST_PAYLOAD:
      return t('Please review your registration details and try again.');
    case Error.REQUEST_BODY_TOO_LARGE:
    case Error.REQUEST_INPUT_LIMIT_EXCEEDED:
      return t('Some registration details are too long. Shorten them and try again.');
    case Error.UNAUTHORIZED_ACCESS:
      return t('This registration link is invalid or expired.');
    default:
      break;
  }

  if (!error.status) {
    return t('Unable to reach registration service. Check your connection and try again.');
  }
  if (error.status === 409) {
    return t(genericDuplicateMessage);
  }
  if (error.status >= 500) {
    return t('Registration is temporarily unavailable. Please try again later.');
  }
  return t('Please review your registration details and try again.');
};
