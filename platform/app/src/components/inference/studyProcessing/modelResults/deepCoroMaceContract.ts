export const DEEP_CORO_MACE_MODEL_NAME = 'DeepCORO_MACE';
export const DEEP_CORO_MACE_SUPPORTED_MODEL_VERSIONS = ['1.0.0'] as const;

export const DEEP_CORO_MACE_PRIMARY_ENDPOINTS = [
  'compositeMace',
  'urgentRevascularization',
  'nonFatalMyocardialInfarction',
  'completeCoronaryOcclusion',
] as const;

export const DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS = [
  'cardiovascularDeath',
  'nonFatalStroke',
  'heartFailureHospitalization',
  'lifeThreateningArrhythmia',
  'cardiogenicShock',
] as const;

export type DeepCoroMaceEndpointKey =
  | (typeof DEEP_CORO_MACE_PRIMARY_ENDPOINTS)[number]
  | (typeof DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS)[number];

export interface DeepCoroMaceEndpoint {
  probability: number;
  threshold: number;
  aboveResearchThreshold: boolean;
}

export interface DeepCoroMaceResultPayload {
  diagnosis: string;
  predictions: {
    timeHorizon: '1 year';
    primary: Record<(typeof DEEP_CORO_MACE_PRIMARY_ENDPOINTS)[number], DeepCoroMaceEndpoint>;
    exploratory: Record<
      (typeof DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS)[number],
      DeepCoroMaceEndpoint
    >;
    thresholdNote: string;
  };
  modelRecommendations: {
    en: string;
    fr: string;
    presentable: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseEndpoint(value: unknown): DeepCoroMaceEndpoint | null {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !isProbability(value.probability) ||
    !isProbability(value.threshold) ||
    typeof value.aboveResearchThreshold !== 'boolean' ||
    (value.warning !== undefined && typeof value.warning !== 'string')
  ) {
    return null;
  }

  return {
    probability: value.probability,
    threshold: value.threshold,
    aboveResearchThreshold: value.aboveResearchThreshold,
  };
}

function parseEndpointGroup<T extends readonly DeepCoroMaceEndpointKey[]>(
  value: unknown,
  keys: T
): Record<T[number], DeepCoroMaceEndpoint> | null {
  if (!isRecord(value)) {
    return null;
  }

  const parsed = {} as Record<T[number], DeepCoroMaceEndpoint>;
  for (const key of keys) {
    const endpoint = parseEndpoint(value[key]);
    if (!endpoint) {
      return null;
    }
    parsed[key] = endpoint;
  }
  return parsed;
}

export function parseDeepCoroMaceResultPayload(value: unknown): DeepCoroMaceResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.diagnosis !== 'string' ||
    !isRecord(value.predictions) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  const { predictions, modelRecommendations } = value;
  if (
    predictions.timeHorizon !== '1 year' ||
    typeof predictions.thresholdNote !== 'string' ||
    typeof modelRecommendations.en !== 'string' ||
    typeof modelRecommendations.fr !== 'string' ||
    typeof modelRecommendations.presentable !== 'boolean'
  ) {
    return null;
  }

  const primary = parseEndpointGroup(predictions.primary, DEEP_CORO_MACE_PRIMARY_ENDPOINTS);
  const exploratory = parseEndpointGroup(
    predictions.exploratory,
    DEEP_CORO_MACE_EXPLORATORY_ENDPOINTS
  );
  if (!primary || !exploratory) {
    return null;
  }

  return {
    diagnosis: value.diagnosis,
    predictions: {
      timeHorizon: '1 year',
      primary,
      exploratory,
      thresholdNote: predictions.thresholdNote,
    },
    modelRecommendations: {
      en: modelRecommendations.en,
      fr: modelRecommendations.fr,
      presentable: modelRecommendations.presentable,
    },
  };
}
