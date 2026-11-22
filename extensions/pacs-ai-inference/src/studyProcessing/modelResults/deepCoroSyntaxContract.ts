export const DEEP_CORO_SYNTAX_MODEL_NAME = 'DeepCORO-SYNTAX';
export const DEEP_CORO_SYNTAX_SUPPORTED_MODEL_VERSIONS = ['5.0.0'] as const;

export const DEEP_CORO_SYNTAX_BANDS = [
  'Zero',
  'Low (1-22)',
  'Intermediate (23-32)',
  'High (>=33)',
] as const;
export const DEEP_CORO_SYNTAX_SEVERITY_CLASSES = ['0', '1-22', '23-32', '>=33'] as const;

export type DeepCoroSyntaxBand = (typeof DEEP_CORO_SYNTAX_BANDS)[number];
export type DeepCoroSyntaxSeverityClass = (typeof DEEP_CORO_SYNTAX_SEVERITY_CLASSES)[number];

export interface DeepCoroSyntaxResultPayload {
  diagnosis: string;
  predictions: {
    syntax: {
      value: number;
      unit: 'points';
      band: DeepCoroSyntaxBand;
      bandIndex: number;
    };
    territory: {
      left: number;
      right: number;
      unit: 'points';
    };
    severityHead: {
      class: DeepCoroSyntaxSeverityClass;
      probabilities: Record<DeepCoroSyntaxSeverityClass, number>;
    };
    intermediateToHigh: {
      positive: boolean;
      threshold: number;
      note: string;
    };
  };
  modelRecommendations: {
    en: string;
    fr: string;
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

export function parseDeepCoroSyntaxResultPayload(
  value: unknown
): DeepCoroSyntaxResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.diagnosis !== 'string' ||
    !isRecord(value.predictions) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  const { predictions, modelRecommendations } = value;
  const syntax = predictions.syntax;
  const territory = predictions.territory;
  const severityHead = predictions.severityHead;
  const intermediateToHigh = predictions.intermediateToHigh;

  if (
    !isRecord(syntax) ||
    !isRecord(territory) ||
    !isRecord(severityHead) ||
    !isRecord(severityHead.probabilities) ||
    !isRecord(intermediateToHigh) ||
    !isNumberInRange(syntax.value, 0, 100) ||
    syntax.unit !== 'points' ||
    !isOneOf(syntax.band, DEEP_CORO_SYNTAX_BANDS) ||
    !Number.isInteger(syntax.bandIndex) ||
    !isNumberInRange(syntax.bandIndex, 0, 3) ||
    !isNumberInRange(territory.left, 0, 100) ||
    !isNumberInRange(territory.right, 0, 100) ||
    territory.unit !== 'points' ||
    !isOneOf(severityHead.class, DEEP_CORO_SYNTAX_SEVERITY_CLASSES) ||
    typeof intermediateToHigh.positive !== 'boolean' ||
    !isNumberInRange(intermediateToHigh.threshold, 0, 100) ||
    typeof intermediateToHigh.note !== 'string' ||
    typeof modelRecommendations.en !== 'string' ||
    typeof modelRecommendations.fr !== 'string'
  ) {
    return null;
  }

  const probabilities = {} as Record<DeepCoroSyntaxSeverityClass, number>;
  for (const severityClass of DEEP_CORO_SYNTAX_SEVERITY_CLASSES) {
    const probability = severityHead.probabilities[severityClass];
    if (!isNumberInRange(probability, 0, 1)) {
      return null;
    }
    probabilities[severityClass] = probability;
  }

  return {
    diagnosis: value.diagnosis,
    predictions: {
      syntax: {
        value: syntax.value,
        unit: 'points',
        band: syntax.band,
        bandIndex: syntax.bandIndex,
      },
      territory: { left: territory.left, right: territory.right, unit: 'points' },
      severityHead: { class: severityHead.class, probabilities },
      intermediateToHigh: {
        positive: intermediateToHigh.positive,
        threshold: intermediateToHigh.threshold,
        note: intermediateToHigh.note,
      },
    },
    modelRecommendations: {
      en: modelRecommendations.en,
      fr: modelRecommendations.fr,
    },
  };
}
