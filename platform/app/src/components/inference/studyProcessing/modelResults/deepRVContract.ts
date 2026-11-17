export const DEEP_RV_MODEL_NAME = 'DeepRV';
export const DEEP_RV_SUPPORTED_MODEL_VERSIONS = ['1.0.0'] as const;

export const DEEP_RV_CLASSES = [0, 1] as const;
export const DEEP_RV_PROBABILITY_RANGE = { minimum: 0, maximum: 1 } as const;

export type DeepRVClass = (typeof DEEP_RV_CLASSES)[number];

export interface DeepRVPrediction {
  probability: number;
  class: DeepRVClass;
}

export interface DeepRVResultPayload {
  diagnosis: string;
  predictions: DeepRVPrediction;
  modelRecommendations: {
    en: string;
    fr: string;
    presentable: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteProbability(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= DEEP_RV_PROBABILITY_RANGE.minimum &&
    value <= DEEP_RV_PROBABILITY_RANGE.maximum
  );
}

function isDeepRVClass(value: unknown): value is DeepRVClass {
  return typeof value === 'number' && DEEP_RV_CLASSES.some(modelClass => modelClass === value);
}

export function parseDeepRVResultPayload(value: unknown): DeepRVResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.diagnosis !== 'string' ||
    !isRecord(value.predictions) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  if (
    !isFiniteProbability(value.predictions.probability) ||
    !isDeepRVClass(value.predictions.class)
  ) {
    return null;
  }

  const recommendations = value.modelRecommendations;
  if (
    typeof recommendations.en !== 'string' ||
    typeof recommendations.fr !== 'string' ||
    typeof recommendations.presentable !== 'boolean'
  ) {
    return null;
  }

  return {
    diagnosis: value.diagnosis,
    predictions: {
      probability: value.predictions.probability,
      class: value.predictions.class,
    },
    modelRecommendations: {
      en: recommendations.en,
      fr: recommendations.fr,
      presentable: recommendations.presentable,
    },
  };
}
