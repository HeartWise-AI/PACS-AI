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

export enum Error {
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export enum Languages {
  EN = 'English',
  FR = 'French',
  ES = 'Spanish',
  DE = 'German',
  AR = 'Arabic',
}
