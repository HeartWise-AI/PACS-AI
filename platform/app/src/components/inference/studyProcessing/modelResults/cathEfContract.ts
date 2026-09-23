export const CATH_EF_MODEL_NAME = 'CathEF';
export const CATH_EF_SUPPORTED_MODEL_VERSIONS = ['1.6.0'] as const;

export const CATH_EF_VESSEL_TYPES = [
  'Aorta',
  'Catheter',
  'Femoral',
  'Graft',
  'LV',
  'Left Coronary',
  'Other',
  'Pigtail',
  'Radial',
  'Right Coronary',
  'Stenting',
  'Unknown Vessel',
] as const;

export type CathEfVesselType = (typeof CATH_EF_VESSEL_TYPES)[number];

export interface CathEfVesselPrediction {
  seriesNumber: number;
  vessel: CathEfVesselType;
}

export interface CathEfLvefPrediction {
  seriesNumber: number;
  value: number;
}

export interface CathEfResultPayload {
  predictions: {
    vessels: CathEfVesselPrediction[];
    LVEF?: {
      presentable: boolean;
      values: CathEfLvefPrediction[];
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

function isSeriesNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isVesselType(value: unknown): value is CathEfVesselType {
  return typeof value === 'string' && CATH_EF_VESSEL_TYPES.some(candidate => candidate === value);
}

function parseVessel(value: unknown): CathEfVesselPrediction | null {
  if (!isRecord(value) || !isSeriesNumber(value.seriesNumber) || !isVesselType(value.vessel)) {
    return null;
  }
  return { seriesNumber: value.seriesNumber, vessel: value.vessel };
}

function parseLvef(value: unknown): CathEfLvefPrediction | null {
  if (
    !isRecord(value) ||
    !isSeriesNumber(value.seriesNumber) ||
    typeof value.value !== 'number' ||
    !Number.isFinite(value.value) ||
    value.value < 0 ||
    value.value > 100
  ) {
    return null;
  }
  return { seriesNumber: value.seriesNumber, value: value.value };
}

export function parseCathEfResultPayload(value: unknown): CathEfResultPayload | null {
  if (
    !isRecord(value) ||
    !isRecord(value.predictions) ||
    !Array.isArray(value.predictions.vessels) ||
    !isRecord(value.modelRecommendations)
  ) {
    return null;
  }

  const vessels: CathEfVesselPrediction[] = [];
  for (const candidate of value.predictions.vessels) {
    const vessel = parseVessel(candidate);
    if (!vessel) {
      return null;
    }
    vessels.push(vessel);
  }

  const recommendations = value.modelRecommendations;
  if (
    typeof recommendations.en !== 'string' ||
    typeof recommendations.fr !== 'string' ||
    typeof recommendations.presentable !== 'boolean'
  ) {
    return null;
  }

  let LVEF: CathEfResultPayload['predictions']['LVEF'];
  if (value.predictions.LVEF !== undefined) {
    if (
      !isRecord(value.predictions.LVEF) ||
      typeof value.predictions.LVEF.presentable !== 'boolean' ||
      !Array.isArray(value.predictions.LVEF.values) ||
      value.predictions.LVEF.values.length === 0
    ) {
      return null;
    }
    const values: CathEfLvefPrediction[] = [];
    for (const candidate of value.predictions.LVEF.values) {
      const lvef = parseLvef(candidate);
      if (!lvef || !vessels.some(vessel => vessel.seriesNumber === lvef.seriesNumber)) {
        return null;
      }
      values.push(lvef);
    }
    LVEF = { presentable: value.predictions.LVEF.presentable, values };
  }

  return {
    predictions: { vessels, ...(LVEF ? { LVEF } : {}) },
    modelRecommendations: {
      en: recommendations.en,
      fr: recommendations.fr,
      presentable: recommendations.presentable,
    },
  };
}
