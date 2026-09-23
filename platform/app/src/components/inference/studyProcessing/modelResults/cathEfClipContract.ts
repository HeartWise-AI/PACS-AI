export const CATH_EF_CLIP_MODEL_NAME = 'CathEF-CLIP';
export const CATH_EF_CLIP_SUPPORTED_MODEL_VERSIONS = ['1.0.0'] as const;
export const CATH_EF_CLIP_DIAGNOSES = ['reduced', 'preserved'] as const;

export type CathEfClipDiagnosis = (typeof CATH_EF_CLIP_DIAGNOSES)[number];

export interface CathEfClipResultPayload {
  diagnosis: string;
  predictions: {
    LVEF: {
      value: number;
      unit: '%';
    };
    reducedEF: {
      probability: number;
      threshold: number;
      diagnosis: CathEfClipDiagnosis;
    };
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

function isFiniteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function isDiagnosis(value: unknown): value is CathEfClipDiagnosis {
  return typeof value === 'string' && CATH_EF_CLIP_DIAGNOSES.some(candidate => candidate === value);
}

export function parseCathEfClipResultPayload(value: unknown): CathEfClipResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.diagnosis !== 'string' ||
    !isRecord(value.predictions) ||
    !isRecord(value.predictions.LVEF) ||
    !isRecord(value.predictions.reducedEF) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  const { LVEF, reducedEF } = value.predictions;
  const recommendations = value.modelRecommendations;
  if (
    !isFiniteInRange(LVEF.value, 0, 100) ||
    LVEF.unit !== '%' ||
    !isFiniteInRange(reducedEF.probability, 0, 1) ||
    !isFiniteInRange(reducedEF.threshold, 0, 1) ||
    !isDiagnosis(reducedEF.diagnosis) ||
    typeof recommendations.en !== 'string' ||
    typeof recommendations.fr !== 'string' ||
    typeof recommendations.presentable !== 'boolean'
  ) {
    return null;
  }

  return {
    diagnosis: value.diagnosis,
    predictions: {
      LVEF: { value: LVEF.value, unit: '%' },
      reducedEF: {
        probability: reducedEF.probability,
        threshold: reducedEF.threshold,
        diagnosis: reducedEF.diagnosis,
      },
    },
    modelRecommendations: {
      en: recommendations.en,
      fr: recommendations.fr,
      presentable: recommendations.presentable,
    },
  };
}
