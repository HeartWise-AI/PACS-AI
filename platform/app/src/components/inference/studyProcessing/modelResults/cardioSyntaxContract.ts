export const CARDIO_SYNTAX_MODEL_NAME = 'CardioSyntax';
export const CARDIO_SYNTAX_SUPPORTED_MODEL_VERSIONS = ['1.0.0'] as const;

export const CARDIO_SYNTAX_TERRITORIES = [
  'Global Cardiac Syntax',
  'Left Cardiac Syntax',
  'Right Cardiac Syntax',
] as const;

export const CARDIO_SYNTAX_CATEGORIES = ['no_disease', 'mild', 'moderate', 'severe'] as const;

export type CardioSyntaxTerritory = (typeof CARDIO_SYNTAX_TERRITORIES)[number];
export type CardioSyntaxCategory = (typeof CARDIO_SYNTAX_CATEGORIES)[number];

export interface CardioSyntaxPrediction {
  regression: number;
  category: CardioSyntaxCategory;
}

export interface CardioSyntaxResultPayload {
  diagnosis: string;
  predictions: Record<CardioSyntaxTerritory, CardioSyntaxPrediction>;
  modelRecommendations: {
    en: string;
    fr: string;
    presentable: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCardioSyntaxCategory(value: unknown): value is CardioSyntaxCategory {
  return typeof value === 'string' && CARDIO_SYNTAX_CATEGORIES.some(category => category === value);
}

function parsePrediction(value: unknown): CardioSyntaxPrediction | null {
  if (!isRecord(value)) {
    return null;
  }

  const regression = value.regression;
  const category = value.category;
  if (
    typeof regression !== 'number' ||
    !Number.isFinite(regression) ||
    !isCardioSyntaxCategory(category)
  ) {
    return null;
  }

  return { regression, category };
}

export function parseCardioSyntaxResultPayload(value: unknown): CardioSyntaxResultPayload | null {
  if (!isRecord(value) || typeof value.diagnosis !== 'string') {
    return null;
  }

  if (!isRecord(value.predictions) || !isRecord(value.modelRecommendations)) {
    return null;
  }

  const predictions = {} as Record<CardioSyntaxTerritory, CardioSyntaxPrediction>;
  for (const territory of CARDIO_SYNTAX_TERRITORIES) {
    const prediction = parsePrediction(value.predictions[territory]);
    if (!prediction) {
      return null;
    }
    predictions[territory] = prediction;
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
