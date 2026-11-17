export const DEEP_CORO_CTO_MODEL_NAME = 'DeepCORO-CTO';
export const DEEP_CORO_CTO_SUPPORTED_MODEL_VERSIONS = ['2.0.0'] as const;

export const DEEP_CORO_CTO_COMPONENTS = [
  'jcto_blunt_stump',
  'jcto_calcification',
  'jcto_bending_gt45',
  'jcto_occlusion_length_gt20',
] as const;
export const DEEP_CORO_CTO_ARTERIES = ['LAD', 'RCA', 'LCx'] as const;
export const DEEP_CORO_CTO_DIFFICULTIES = [
  'easy',
  'intermediate',
  'difficult',
  'very difficult',
] as const;

export type DeepCoroCtoComponentKey = (typeof DEEP_CORO_CTO_COMPONENTS)[number];
export type DeepCoroCtoArtery = (typeof DEEP_CORO_CTO_ARTERIES)[number];
export type DeepCoroCtoDifficulty = (typeof DEEP_CORO_CTO_DIFFICULTIES)[number];

export interface DeepCoroCtoComponent {
  probability: number;
  threshold: number;
  present: boolean;
}

export interface DeepCoroCtoArteryResult {
  jctoScore: number;
  jctoScoreInteger: number;
  components: Record<DeepCoroCtoComponentKey, number>;
}

export interface DeepCoroCtoResultPayload {
  diagnosis: string;
  predictions: {
    jctoScore: {
      predicted: number;
      predictedInteger: number;
      componentsAboveThreshold: number;
      difficulty: DeepCoroCtoDifficulty;
    };
    components: Record<DeepCoroCtoComponentKey, DeepCoroCtoComponent>;
    ctoArtery: DeepCoroCtoArtery;
    perArtery: Record<DeepCoroCtoArtery, DeepCoroCtoArteryResult>;
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

function isNumberInRange(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && options.some(option => option === value);
}

function parseComponent(value: unknown): DeepCoroCtoComponent | null {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !isNumberInRange(value.probability, 0, 1) ||
    !isNumberInRange(value.threshold, 0, 1) ||
    typeof value.present !== 'boolean'
  ) {
    return null;
  }
  return { probability: value.probability, threshold: value.threshold, present: value.present };
}

function parseArteryResult(value: unknown): DeepCoroCtoArteryResult | null {
  if (
    !isRecord(value) ||
    !isNumberInRange(value.jctoScore, 0, 4) ||
    !Number.isInteger(value.jctoScoreInteger) ||
    !isNumberInRange(value.jctoScoreInteger, 0, 4) ||
    !isRecord(value.components)
  ) {
    return null;
  }

  const components = {} as Record<DeepCoroCtoComponentKey, number>;
  for (const key of DEEP_CORO_CTO_COMPONENTS) {
    const probability = value.components[key];
    if (!isNumberInRange(probability, 0, 1)) {
      return null;
    }
    components[key] = probability;
  }
  return { jctoScore: value.jctoScore, jctoScoreInteger: value.jctoScoreInteger, components };
}

export function parseDeepCoroCtoResultPayload(value: unknown): DeepCoroCtoResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.diagnosis !== 'string' ||
    !isRecord(value.predictions) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  const { predictions, modelRecommendations } = value;
  const score = predictions.jctoScore;
  if (
    !isRecord(score) ||
    !isRecord(predictions.components) ||
    !isRecord(predictions.perArtery) ||
    !isNumberInRange(score.predicted, 0, 4) ||
    !Number.isInteger(score.predictedInteger) ||
    !isNumberInRange(score.predictedInteger, 0, 4) ||
    !Number.isInteger(score.componentsAboveThreshold) ||
    !isNumberInRange(score.componentsAboveThreshold, 0, 4) ||
    !isOneOf(score.difficulty, DEEP_CORO_CTO_DIFFICULTIES) ||
    !isOneOf(predictions.ctoArtery, DEEP_CORO_CTO_ARTERIES) ||
    typeof modelRecommendations.en !== 'string' ||
    typeof modelRecommendations.fr !== 'string' ||
    typeof modelRecommendations.presentable !== 'boolean'
  ) {
    return null;
  }

  if (predictions.ctoArteryWarning !== undefined) {
    const warning = predictions.ctoArteryWarning;
    if (!isRecord(warning) || typeof warning.en !== 'string' || typeof warning.fr !== 'string') {
      return null;
    }
  }

  const components = {} as Record<DeepCoroCtoComponentKey, DeepCoroCtoComponent>;
  for (const key of DEEP_CORO_CTO_COMPONENTS) {
    const component = parseComponent(predictions.components[key]);
    if (!component) {
      return null;
    }
    components[key] = component;
  }

  const perArtery = {} as Record<DeepCoroCtoArtery, DeepCoroCtoArteryResult>;
  for (const artery of DEEP_CORO_CTO_ARTERIES) {
    const arteryResult = parseArteryResult(predictions.perArtery[artery]);
    if (!arteryResult) {
      return null;
    }
    perArtery[artery] = arteryResult;
  }

  return {
    diagnosis: value.diagnosis,
    predictions: {
      jctoScore: {
        predicted: score.predicted,
        predictedInteger: score.predictedInteger,
        componentsAboveThreshold: score.componentsAboveThreshold,
        difficulty: score.difficulty,
      },
      components,
      ctoArtery: predictions.ctoArtery,
      perArtery,
    },
    modelRecommendations: {
      en: modelRecommendations.en,
      fr: modelRecommendations.fr,
      presentable: modelRecommendations.presentable,
    },
  };
}
