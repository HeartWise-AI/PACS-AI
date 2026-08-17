import type { ModelExecutionResult } from '../types';
import {
  CARDIO_SYNTAX_MODEL_NAME,
  CARDIO_SYNTAX_SUPPORTED_MODEL_VERSIONS,
  type CardioSyntaxResultPayload,
  parseCardioSyntaxResultPayload,
} from './cardioSyntaxContract';
import {
  DEEP_CORO_CLIP_MODEL_NAME,
  DEEP_CORO_CLIP_SUPPORTED_MODEL_VERSIONS,
  type DeepCoroClipResultPayload,
  parseDeepCoroClipResultPayload,
} from './deepCoroClipContract';

interface ModelResultRendererContext {
  modelName: string;
  modelVersion: string | null;
  result: unknown;
}

export type ResolvedModelResultRenderer =
  | {
      kind: 'cardiosyntax';
      payload: CardioSyntaxResultPayload;
    }
  | {
      kind: 'deepcoro-clip';
      payload: DeepCoroClipResultPayload;
    }
  | {
      kind: 'generic';
      payload: unknown;
    };

interface ModelResultRendererAdapter {
  matches(context: ModelResultRendererContext): boolean;
  resolve(context: ModelResultRendererContext): ResolvedModelResultRenderer | null;
}

const cardioSyntaxAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === CARDIO_SYNTAX_MODEL_NAME &&
    CARDIO_SYNTAX_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseCardioSyntaxResultPayload(result);
    return payload ? { kind: 'cardiosyntax', payload } : null;
  },
};

const deepCoroClipAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === DEEP_CORO_CLIP_MODEL_NAME &&
    DEEP_CORO_CLIP_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseDeepCoroClipResultPayload(result);
    return payload ? { kind: 'deepcoro-clip', payload } : null;
  },
};

const modelResultRendererAdapters: readonly ModelResultRendererAdapter[] = [
  cardioSyntaxAdapter,
  deepCoroClipAdapter,
];

export function resolveModelResultRenderer(
  result: Pick<ModelExecutionResult, 'modelName' | 'modelVersion' | 'result'>
): ResolvedModelResultRenderer {
  const context: ModelResultRendererContext = {
    modelName: result.modelName,
    modelVersion: result.modelVersion,
    result: result.result,
  };

  const adapter = modelResultRendererAdapters.find(candidate => candidate.matches(context));
  if (adapter) {
    try {
      const resolved = adapter.resolve(context);
      if (resolved) {
        return resolved;
      }
    } catch {
      // Model adapters are optional presentation enhancements. Their failures must not hide data.
    }
  }

  return { kind: 'generic', payload: result.result };
}
