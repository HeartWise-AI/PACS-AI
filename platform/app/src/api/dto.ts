export interface APIResponse<T> {
  readonly success: boolean;
  readonly message: string;
  readonly errorCode?: string;
  readonly data: T;
}

export interface ErrorAPIResponse {
  readonly success: boolean;
  readonly message: string;
  readonly errorCode?: string;
}

export interface GetAPIInfoResponse {
  readonly version: string;
}

export enum Error {
  CLOUDFLARE_API_ERROR = 'CLOUDFLARE_API_ERROR',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  FIREBASE_AUTH_EMAIL_NOT_VERIFIED = 'FIREBASE_AUTH_EMAIL_NOT_VERIFIED',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  INVALID_REQUEST_PAYLOAD = 'INVALID_REQUEST_PAYLOAD',
  REGISTRATION_RATE_LIMITED = 'REGISTRATION_RATE_LIMITED',
  REQUEST_BODY_TOO_LARGE = 'REQUEST_BODY_TOO_LARGE',
  REQUEST_INPUT_LIMIT_EXCEEDED = 'REQUEST_INPUT_LIMIT_EXCEEDED',
  TURNSTILE_INVALID = 'TURNSTILE_INVALID',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export enum Languages {
  EN = 'English',
  FR = 'French',
  ES = 'Spanish',
  DE = 'German',
  AR = 'Arabic',
}
