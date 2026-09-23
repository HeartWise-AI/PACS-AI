import type { ModelExecutionResult } from '../types';
import {
  CARDIO_SYNTAX_MODEL_NAME,
  CARDIO_SYNTAX_SUPPORTED_MODEL_VERSIONS,
  type CardioSyntaxResultPayload,
  parseCardioSyntaxResultPayload,
} from './cardioSyntaxContract';
import {
  CATH_EF_CLIP_MODEL_NAME,
  CATH_EF_CLIP_SUPPORTED_MODEL_VERSIONS,
  type CathEfClipResultPayload,
  parseCathEfClipResultPayload,
} from './cathEfClipContract';
import {
  CATH_EF_MODEL_NAME,
  CATH_EF_SUPPORTED_MODEL_VERSIONS,
  type CathEfResultPayload,
  parseCathEfResultPayload,
} from './cathEfContract';
import {
  DEEP_CORO_CLIP_MODEL_NAME,
  DEEP_CORO_CLIP_SUPPORTED_MODEL_VERSIONS,
  type DeepCoroClipResultPayload,
  parseDeepCoroClipResultPayload,
} from './deepCoroClipContract';
import {
  DEEP_CORO_MACE_MODEL_NAME,
  DEEP_CORO_MACE_SUPPORTED_MODEL_VERSIONS,
  type DeepCoroMaceResultPayload,
  parseDeepCoroMaceResultPayload,
} from './deepCoroMaceContract';
import {
  DEEP_RV_CLIP_MODEL_NAME,
  DEEP_RV_CLIP_SUPPORTED_MODEL_VERSIONS,
  type DeepRVClipResultPayload,
  parseDeepRVClipResultPayload,
} from './deepRVClipContract';
import {
  DEEP_RV_MODEL_NAME,
  DEEP_RV_SUPPORTED_MODEL_VERSIONS,
  type DeepRVResultPayload,
  parseDeepRVResultPayload,
} from './deepRVContract';
import {
  ECHO_PRIME_MODEL_NAME,
  ECHO_PRIME_SUPPORTED_MODEL_VERSIONS,
  type EchoPrimeResultPayload,
  parseEchoPrimeResultPayload,
} from './echoPrimeContract';
import {
  PAN_ECHO_MODEL_NAME,
  PAN_ECHO_SUPPORTED_MODEL_VERSIONS,
  type PanEchoResultPayload,
  parsePanEchoResultPayload,
} from './panEchoContract';

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
      kind: 'cathef-clip';
      payload: CathEfClipResultPayload;
    }
  | {
      kind: 'cathef';
      payload: CathEfResultPayload;
    }
  | {
      kind: 'deepcoro-clip';
      payload: DeepCoroClipResultPayload;
    }
  | {
      kind: 'deepcoro-mace';
      payload: DeepCoroMaceResultPayload;
    }
  | {
      kind: 'deeprv-clip';
      payload: DeepRVClipResultPayload;
    }
  | {
      kind: 'deeprv';
      payload: DeepRVResultPayload;
    }
  | {
      kind: 'panecho';
      payload: PanEchoResultPayload;
    }
  | {
      kind: 'echoprime';
      payload: EchoPrimeResultPayload;
    }
  | {
      kind: 'unsupported';
      modelName: string;
      modelVersion: string | null;
      payload: unknown;
      reason: 'payload' | 'version';
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

const cathEfClipAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === CATH_EF_CLIP_MODEL_NAME &&
    CATH_EF_CLIP_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseCathEfClipResultPayload(result);
    return payload ? { kind: 'cathef-clip', payload } : null;
  },
};

const cathEfAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === CATH_EF_MODEL_NAME &&
    CATH_EF_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseCathEfResultPayload(result);
    return payload ? { kind: 'cathef', payload } : null;
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

const deepCoroMaceAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === DEEP_CORO_MACE_MODEL_NAME &&
    DEEP_CORO_MACE_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseDeepCoroMaceResultPayload(result);
    return payload ? { kind: 'deepcoro-mace', payload } : null;
  },
};

const deepRVClipAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === DEEP_RV_CLIP_MODEL_NAME &&
    DEEP_RV_CLIP_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseDeepRVClipResultPayload(result);
    return payload ? { kind: 'deeprv-clip', payload } : null;
  },
};

const deepRVAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === DEEP_RV_MODEL_NAME &&
    DEEP_RV_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseDeepRVResultPayload(result);
    return payload ? { kind: 'deeprv', payload } : null;
  },
};

const panEchoAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === PAN_ECHO_MODEL_NAME &&
    PAN_ECHO_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parsePanEchoResultPayload(result);
    return payload ? { kind: 'panecho', payload } : null;
  },
};

const echoPrimeAdapter: ModelResultRendererAdapter = {
  matches: ({ modelName, modelVersion }) =>
    modelName === ECHO_PRIME_MODEL_NAME &&
    ECHO_PRIME_SUPPORTED_MODEL_VERSIONS.some(version => version === modelVersion),
  resolve: ({ result }) => {
    const payload = parseEchoPrimeResultPayload(result);
    return payload ? { kind: 'echoprime', payload } : null;
  },
};

const modelResultRendererAdapters: readonly ModelResultRendererAdapter[] = [
  cardioSyntaxAdapter,
  cathEfClipAdapter,
  cathEfAdapter,
  deepCoroClipAdapter,
  deepCoroMaceAdapter,
  deepRVClipAdapter,
  deepRVAdapter,
  panEchoAdapter,
  echoPrimeAdapter,
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

  const knownEchoModel =
    context.modelName === PAN_ECHO_MODEL_NAME || context.modelName === ECHO_PRIME_MODEL_NAME;
  if (knownEchoModel) {
    return {
      kind: 'unsupported',
      modelName: context.modelName,
      modelVersion: context.modelVersion,
      payload: context.result,
      reason: adapter ? 'payload' : 'version',
    };
  }

  return { kind: 'generic', payload: result.result };
}
