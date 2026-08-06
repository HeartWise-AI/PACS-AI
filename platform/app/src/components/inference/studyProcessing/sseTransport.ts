import type { WorklistStudyStatusEventDTO } from './restDTO';
import {
  createServerSentEventParser,
  parseWorklistStudyStatusEvent,
  WORKLIST_STUDY_STATUS_EVENT,
  type ServerSentEventFrame,
} from './sseParser';

export const STUDY_PROCESSING_EVENTS_PATH = '/v1/inference/worklist/events';

export interface StudyProcessingSSEReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  releaseLock(): void;
}

export interface StudyProcessingSSEResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: { getReader(): StudyProcessingSSEReader } | null;
}

export interface StudyProcessingSSERequestInit {
  method: 'GET';
  headers: Record<string, string>;
  signal?: AbortSignal;
}

export type StudyProcessingSSEFetch = (
  url: string,
  init: StudyProcessingSSERequestInit
) => Promise<StudyProcessingSSEResponse>;

export interface StudyProcessingTextDecoder {
  decode(input?: Uint8Array, options?: { stream?: boolean }): string;
}

export interface StreamStudyProcessingEventsOptions {
  apiBaseURL?: string;
  getAuthorizationHeader?: () => Record<string, string> | undefined;
  fetchImplementation?: StudyProcessingSSEFetch;
  createTextDecoder?: () => StudyProcessingTextDecoder;
  signal?: AbortSignal;
  onEvent(event: WorklistStudyStatusEventDTO): void;
  onInvalidEvent?(): void;
}

export class StudyProcessingSSEError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'StudyProcessingSSEError';
    this.status = status;
  }
}

function defaultAuthorizationHeader(): Record<string, string> | undefined {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function eventsURL(apiBaseURL: string): string {
  return `${apiBaseURL.replace(/\/$/, '')}${STUDY_PROCESSING_EVENTS_PATH}`;
}

function safeConnectionError(status: number): StudyProcessingSSEError {
  const messageByStatus: Record<number, string> = {
    401: 'Authentication is required for live processing updates.',
    403: 'You do not have permission to receive live processing updates.',
    500: 'The live processing update service encountered an error.',
    503: 'The live processing update service is temporarily unavailable.',
  };

  return new StudyProcessingSSEError(
    messageByStatus[status] || 'Unable to connect to live processing updates.',
    status
  );
}

function dispatchFrames(
  frames: ServerSentEventFrame[],
  options: StreamStudyProcessingEventsOptions
) {
  frames.forEach(frame => {
    if (frame.event !== WORKLIST_STUDY_STATUS_EVENT) {
      return;
    }

    const event = parseWorklistStudyStatusEvent(frame);
    if (event) {
      options.onEvent(event);
    } else {
      options.onInvalidEvent?.();
    }
  });
}

export async function streamStudyProcessingEvents(
  options: StreamStudyProcessingEventsOptions
): Promise<void> {
  const getAuthorizationHeader = options.getAuthorizationHeader ?? defaultAuthorizationHeader;
  const authorizationHeader = getAuthorizationHeader();
  if (!authorizationHeader?.Authorization) {
    throw new StudyProcessingSSEError(
      'Authentication is required for live processing updates.',
      401
    );
  }

  const fetchImplementation =
    options.fetchImplementation ?? (globalThis.fetch as unknown as StudyProcessingSSEFetch);
  if (!fetchImplementation) {
    throw new StudyProcessingSSEError('Live processing updates are unsupported.', null);
  }

  const response = await fetchImplementation(
    eventsURL(options.apiBaseURL ?? process.env.APP_PUBLIC_API_URL ?? ''),
    {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: authorizationHeader.Authorization,
      },
      signal: options.signal,
    }
  );

  if (!response.ok) {
    throw safeConnectionError(response.status);
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('text/event-stream')) {
    throw new StudyProcessingSSEError(
      'The live processing update service returned an invalid response.',
      response.status
    );
  }

  if (!response.body) {
    throw new StudyProcessingSSEError(
      'The live processing update stream was unavailable.',
      response.status
    );
  }

  const reader = response.body.getReader();
  const decoder = options.createTextDecoder?.() ?? new TextDecoder();
  const parser = createServerSentEventParser();

  try {
    let streamComplete = false;
    while (!streamComplete) {
      const { done, value } = await reader.read();
      streamComplete = done;
      if (done) {
        continue;
      }
      if (value) {
        dispatchFrames(parser.push(decoder.decode(value, { stream: true })), options);
      }
    }

    const finalText = decoder.decode();
    if (finalText) {
      dispatchFrames(parser.push(finalText), options);
    }
    dispatchFrames(parser.finish(), options);
  } finally {
    reader.releaseLock();
  }
}
