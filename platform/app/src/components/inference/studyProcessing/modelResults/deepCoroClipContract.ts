export const DEEP_CORO_CLIP_MODEL_NAME = 'DeepCoro_CLIP_generic';
export const DEEP_CORO_CLIP_SUPPORTED_MODEL_VERSIONS = ['1.0.0'] as const;

export const DEEP_CORO_CLIP_ARTERY_GROUPS = {
  rca: [
    'Proximal RCA',
    'Mid RCA',
    'Distal RCA',
    'Posterior Descending Artery',
    'Posterolateral Branch',
  ],
  lca: [
    'Left Main Branch',
    'Proximal LAD',
    'Mid LAD',
    'Distal LAD',
    'D1 Branch',
    'D2 Branch',
    'Proximal LCX',
    'Mid LCX',
    'Distal LCX',
    'OM1 (Obtuse Marginal 1)',
    'OM2 (Obtuse Marginal 2)',
  ],
  other: ['Branch Vessel', 'LVp'],
} as const;

export const DEEP_CORO_CLIP_ARTERIES = [
  ...DEEP_CORO_CLIP_ARTERY_GROUPS.rca,
  ...DEEP_CORO_CLIP_ARTERY_GROUPS.lca,
  ...DEEP_CORO_CLIP_ARTERY_GROUPS.other,
] as const;

export const DEEP_CORO_CLIP_STENOSIS_DIAGNOSES = ['normal', 'blocked'] as const;
export const DEEP_CORO_CLIP_CALCIFICATION_DIAGNOSES = ['normal', 'calcified'] as const;
export const DEEP_CORO_CLIP_CTO_DIAGNOSES = ['normal', 'cto'] as const;
export const DEEP_CORO_CLIP_THROMBUS_DIAGNOSES = ['normal', 'thrombus'] as const;
export const DEEP_CORO_CLIP_PROBABILITY_RANGE = { minimum: 0, maximum: 1 } as const;
export const DEEP_CORO_CLIP_STENOSIS_RANGE = { minimum: 0, maximum: 100 } as const;

export type DeepCoroClipArtery = (typeof DEEP_CORO_CLIP_ARTERIES)[number];
export type DeepCoroClipStenosisDiagnosis = (typeof DEEP_CORO_CLIP_STENOSIS_DIAGNOSES)[number];
export type DeepCoroClipCalcificationDiagnosis =
  (typeof DEEP_CORO_CLIP_CALCIFICATION_DIAGNOSES)[number];
export type DeepCoroClipCtoDiagnosis = (typeof DEEP_CORO_CLIP_CTO_DIAGNOSES)[number];
export type DeepCoroClipThrombusDiagnosis = (typeof DEEP_CORO_CLIP_THROMBUS_DIAGNOSES)[number];

export interface DeepCoroClipPrediction {
  regression: number;
  stenosis_prob: number;
  diagnosis_stenosis: DeepCoroClipStenosisDiagnosis;
  calcif_prob: number;
  diagnosis_calcif: DeepCoroClipCalcificationDiagnosis;
  cto_prob: number;
  diagnosis_cto: DeepCoroClipCtoDiagnosis;
  thrombus_prob: number;
  diagnosis_thrombus: DeepCoroClipThrombusDiagnosis;
}

export interface DeepCoroClipResultPayload {
  diagnosis: string;
  predictions: Record<DeepCoroClipArtery, DeepCoroClipPrediction>;
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

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.some(candidate => candidate === value);
}

function parsePrediction(value: unknown): DeepCoroClipPrediction | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isFiniteInRange(
      value.regression,
      DEEP_CORO_CLIP_STENOSIS_RANGE.minimum,
      DEEP_CORO_CLIP_STENOSIS_RANGE.maximum
    ) ||
    !isFiniteInRange(
      value.stenosis_prob,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.minimum,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.maximum
    ) ||
    !isOneOf(value.diagnosis_stenosis, DEEP_CORO_CLIP_STENOSIS_DIAGNOSES) ||
    !isFiniteInRange(
      value.calcif_prob,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.minimum,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.maximum
    ) ||
    !isOneOf(value.diagnosis_calcif, DEEP_CORO_CLIP_CALCIFICATION_DIAGNOSES) ||
    !isFiniteInRange(
      value.cto_prob,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.minimum,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.maximum
    ) ||
    !isOneOf(value.diagnosis_cto, DEEP_CORO_CLIP_CTO_DIAGNOSES) ||
    !isFiniteInRange(
      value.thrombus_prob,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.minimum,
      DEEP_CORO_CLIP_PROBABILITY_RANGE.maximum
    ) ||
    !isOneOf(value.diagnosis_thrombus, DEEP_CORO_CLIP_THROMBUS_DIAGNOSES)
  ) {
    return null;
  }

  return {
    regression: value.regression,
    stenosis_prob: value.stenosis_prob,
    diagnosis_stenosis: value.diagnosis_stenosis,
    calcif_prob: value.calcif_prob,
    diagnosis_calcif: value.diagnosis_calcif,
    cto_prob: value.cto_prob,
    diagnosis_cto: value.diagnosis_cto,
    thrombus_prob: value.thrombus_prob,
    diagnosis_thrombus: value.diagnosis_thrombus,
  };
}

export function parseDeepCoroClipResultPayload(value: unknown): DeepCoroClipResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.diagnosis !== 'string' ||
    !isRecord(value.predictions) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  const predictions = {} as Record<DeepCoroClipArtery, DeepCoroClipPrediction>;
  for (const artery of DEEP_CORO_CLIP_ARTERIES) {
    const prediction = parsePrediction(value.predictions[artery]);
    if (!prediction) {
      return null;
    }
    predictions[artery] = prediction;
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
    predictions,
    modelRecommendations: {
      en: recommendations.en,
      fr: recommendations.fr,
      presentable: recommendations.presentable,
    },
  };
}
