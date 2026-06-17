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
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  FIREBASE_AUTH_EMAIL_NOT_VERIFIED = 'FIREBASE_AUTH_EMAIL_NOT_VERIFIED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export enum Languages {
  EN = 'English',
  FR = 'French',
  ES = 'Spanish',
  DE = 'German',
  AR = 'Arabic',
}
