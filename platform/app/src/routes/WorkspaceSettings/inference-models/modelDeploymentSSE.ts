import type { InferenceModelDeploymentEvent } from '../../../api/inferenceDTO';
import {
  createServerSentEventParser,
  type ServerSentEventFrame,
} from '../../../components/inference/studyProcessing/sseParser';

export const MODEL_DEPLOYMENT_EVENT = 'model-deployment';

interface ModelDeploymentSSEReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  releaseLock(): void;
}

export interface ModelDeploymentSSEResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  body: { getReader(): ModelDeploymentSSEReader } | null;
}

export type ModelDeploymentSSEFetch = (
  url: string,
  init: {
    method: 'GET';
    headers: Record<string, string>;
    signal?: AbortSignal;
  }
) => Promise<ModelDeploymentSSEResponse>;

export interface StreamModelDeploymentEventsOptions {
  modelId: string;
  deploymentId: string;
  lastEventId?: number;
  apiBaseURL?: string;
  getAuthorizationHeader?: () => Record<string, string> | undefined;
  fetchImplementation?: ModelDeploymentSSEFetch;
  createTextDecoder?: () => { decode(input?: Uint8Array, options?: { stream?: boolean }): string };
  signal?: AbortSignal;
  onOpen?(): void;
  onEvent(event: InferenceModelDeploymentEvent): void;
  onInvalidEvent?(): void;
}

export class ModelDeploymentSSEError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'ModelDeploymentSSEError';
    this.status = status;
  }
}

function defaultAuthorizationHeader(): Record<string, string> | undefined {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function modelDeploymentEventsURL(apiBaseURL: string, modelId: string, deploymentId: string) {
  const baseURL = apiBaseURL.replace(/\/$/, '');
  return `${baseURL}/v1/inference/model/${encodeURIComponent(modelId)}/deployments/${encodeURIComponent(
    deploymentId
  )}/events`;
}

function safeConnectionError(status: number): ModelDeploymentSSEError {
  const messageByStatus: Record<number, string> = {
    401: 'Authentication is required for deployment updates.',
    403: 'You do not have permission to receive deployment updates.',
    404: 'The model deployment could not be found.',
    503: 'Live deployment updates are temporarily unavailable.',
  };
  return new ModelDeploymentSSEError(
    messageByStatus[status] || 'Unable to connect to live deployment updates.',
    status
  );
}

const statuses = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK', 'INTERRUPTED'];
const stages = [
  'resolve_active',
  'resolve_version',
  'pull',
  'create_candidate',
  'validate_candidate',
  'drain_active',
  'prepare_candidate',
  'activate_candidate',
];

function parseDeploymentEvent(frame: ServerSentEventFrame): InferenceModelDeploymentEvent | null {
  if (frame.event !== MODEL_DEPLOYMENT_EVENT) {
    return null;
  }
  try {
    const value = JSON.parse(frame.data) as Record<string, unknown>;
    if (
      typeof value.deploymentId !== 'string' ||
      !statuses.includes(value.status as string) ||
      !stages.includes(value.stage as string) ||
      typeof value.sequence !== 'number' ||
      !Number.isInteger(value.sequence) ||
      value.sequence < 1 ||
      typeof value.timestamp !== 'number' ||
      typeof value.elapsedMilliseconds !== 'number' ||
      value.elapsedMilliseconds < 0 ||
      typeof value.terminal !== 'boolean'
    ) {
      return null;
    }
    return value as unknown as InferenceModelDeploymentEvent;
  } catch {
    return null;
  }
}

function dispatchFrames(
  frames: ServerSentEventFrame[],
  options: StreamModelDeploymentEventsOptions
) {
  frames.forEach(frame => {
    if (frame.event !== MODEL_DEPLOYMENT_EVENT) {
      return;
    }
    const event = parseDeploymentEvent(frame);
    if (event) {
      options.onEvent(event);
    } else {
      options.onInvalidEvent?.();
    }
  });
}

export async function streamModelDeploymentEvents(
  options: StreamModelDeploymentEventsOptions
): Promise<void> {
  const authorizationHeader = (options.getAuthorizationHeader ?? defaultAuthorizationHeader)();
  if (!authorizationHeader?.Authorization) {
    throw new ModelDeploymentSSEError('Authentication is required for deployment updates.', 401);
  }
  const fetchImplementation =
    options.fetchImplementation ?? (globalThis.fetch as unknown as ModelDeploymentSSEFetch);
  if (!fetchImplementation) {
    throw new ModelDeploymentSSEError('Live deployment updates are unsupported.', null);
  }
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: authorizationHeader.Authorization,
  };
  if (options.lastEventId && options.lastEventId > 0) {
    headers['Last-Event-ID'] = String(options.lastEventId);
  }
  const response = await fetchImplementation(
    modelDeploymentEventsURL(
      options.apiBaseURL ?? process.env.APP_PUBLIC_API_URL ?? '',
      options.modelId,
      options.deploymentId
    ),
    { method: 'GET', headers, signal: options.signal }
  );
  if (!response.ok) {
    throw safeConnectionError(response.status);
  }
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('text/event-stream') || !response.body) {
    throw new ModelDeploymentSSEError(
      'The deployment update stream was unavailable.',
      response.status
    );
  }

  options.onOpen?.();
  const reader = response.body.getReader();
  const decoder = options.createTextDecoder?.() ?? new TextDecoder();
  const parser = createServerSentEventParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
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
