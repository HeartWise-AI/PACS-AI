export const DEEP_RV_CLIP_MODEL_NAME = 'DeepRV-CLIP';
export const DEEP_RV_CLIP_SUPPORTED_MODEL_VERSIONS = ['1.0.0'] as const;

export const DEEP_RV_CLIP_DIAGNOSES = ['normal', 'abnormal'] as const;
export const DEEP_RV_CLIP_PROBABILITY_RANGE = { minimum: 0, maximum: 1 } as const;

export type DeepRVClipDiagnosis = (typeof DEEP_RV_CLIP_DIAGNOSES)[number];

export interface DeepRVClipPrediction {
  probability: number;
  threshold: number;
  diagnosis: DeepRVClipDiagnosis;
}

export interface DeepRVClipResultPayload {
  diagnosis: string;
  predictions: {
    abnormalRV: DeepRVClipPrediction;
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

function isFiniteProbability(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= DEEP_RV_CLIP_PROBABILITY_RANGE.minimum &&
    value <= DEEP_RV_CLIP_PROBABILITY_RANGE.maximum
  );
}

function isDeepRVClipDiagnosis(value: unknown): value is DeepRVClipDiagnosis {
  return typeof value === 'string' && DEEP_RV_CLIP_DIAGNOSES.some(diagnosis => diagnosis === value);
}

export function parseDeepRVClipResultPayload(value: unknown): DeepRVClipResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.diagnosis !== 'string' ||
    !isRecord(value.predictions) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  const abnormalRV = value.predictions.abnormalRV;
  if (
    !isRecord(abnormalRV) ||
    !isFiniteProbability(abnormalRV.probability) ||
    !isFiniteProbability(abnormalRV.threshold) ||
    !isDeepRVClipDiagnosis(abnormalRV.diagnosis)
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
      abnormalRV: {
        probability: abnormalRV.probability,
        threshold: abnormalRV.threshold,
        diagnosis: abnormalRV.diagnosis,
      },
    },
    modelRecommendations: {
      en: recommendations.en,
      fr: recommendations.fr,
      presentable: recommendations.presentable,
    },
  };
}
