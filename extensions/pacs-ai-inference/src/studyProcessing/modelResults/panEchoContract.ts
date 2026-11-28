export const PAN_ECHO_MODEL_NAME = 'PanEcho';

// 1.0.0 is the model package contract. The worklist fixture currently reports
// 1.4.0 with the same JSON output shape, so both are intentionally explicit.
export const PAN_ECHO_SUPPORTED_MODEL_VERSIONS = ['1.0.0', '1.4.0'] as const;

// 1.1.x (MHI release line, same JSON output) and 1.2.x (view selection, same
// JSON output) are matched by release line.
export const PAN_ECHO_SUPPORTED_RELEASE_LINES = ['1.1', '1.2'] as const;

export function isSupportedPanEchoVersion(version: string | null | undefined): boolean {
  if (typeof version !== 'string') {
    return false;
  }
  const trimmed = version.trim();
  if (PAN_ECHO_SUPPORTED_MODEL_VERSIONS.some(supported => supported === trimmed)) {
    return true;
  }
  const match = trimmed.match(/^(\d+\.\d+)\.\d+$/);
  return !!match && PAN_ECHO_SUPPORTED_RELEASE_LINES.some(line => line === match[1]);
}

// The aortic stenosis head and the AV peak velocity regression are not shown as
// a diagnosis: PanEcho reads 2D clips only and under-grades severe AS. They are
// shown as screening scores and an AI estimate (see getPanEchoAorticScreening).
export const PAN_ECHO_AS_KEY = 'Aortic valve stenosis';
export const PAN_ECHO_AV_VMAX_KEY = 'Aortic valve peak velocity';
// Head order of the AS classifier (PanEcho tasks.pkl class_names).
export const PAN_ECHO_AS_CLASSES = ['Mild|Moderate', 'None', 'Severe'] as const;

// PanEcho 1.1.3+ adds an MHI-calibrated screening label (thresholds on P(severe) and
// P(any AS) fitted on MHI echos) and a corrected AV Vmax; the uncorrected model output is kept.
export const PAN_ECHO_AV_VMAX_UNCORRECTED_KEY = 'Aortic valve peak velocity (uncorrected)';
export type PanEchoCalibratedAsLabel =
  | 'Significant AS likely, severe possible'
  | 'Significant AS likely'
  | 'No significant AS suspected';
const CALIBRATED_AS_LABEL =
  /^(Significant AS likely, severe possible|Significant AS likely|No significant AS suspected) \(MHI-calibrated screening/;

export interface PanEchoAorticScreening {
  // P(Severe) and P(Mild|Moderate) + P(Severe), 0..1; null when not returned.
  severe: number | null;
  any: number | null;
  // AI-estimated AV peak velocity (m/s); null when not returned. Corrected (calibrated)
  // when vmaxUncorrected is present.
  vmaxEstimate: number | null;
  // MHI-calibrated screening label (PanEcho 1.1.3+); null for uncalibrated versions.
  calibratedLabel: PanEchoCalibratedAsLabel | null;
  vmaxUncorrected: number | null;
}

export function getPanEchoCalibratedAsLabel(
  diagnoses: Record<string, string> | undefined
): PanEchoCalibratedAsLabel | null {
  const text = diagnoses?.[PAN_ECHO_AS_KEY];
  const match = typeof text === 'string' ? text.match(CALIBRATED_AS_LABEL) : null;
  return match ? (match[1] as PanEchoCalibratedAsLabel) : null;
}

function probability(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

export function getPanEchoAorticScreening(
  predictions: Record<string, unknown>,
  diagnoses?: Record<string, string>
): PanEchoAorticScreening | null {
  const scores = predictions[PAN_ECHO_AS_KEY];
  const vmax = predictions[PAN_ECHO_AV_VMAX_KEY];
  const uncorrected = predictions[PAN_ECHO_AV_VMAX_UNCORRECTED_KEY];
  let severe: number | null = null;
  let any: number | null = null;
  if (Array.isArray(scores) && scores.length === PAN_ECHO_AS_CLASSES.length) {
    const mildModerate = probability(scores[0]);
    severe = probability(scores[2]);
    any = mildModerate !== null && severe !== null ? Math.min(1, mildModerate + severe) : null;
  }
  const vmaxEstimate = typeof vmax === 'number' && Number.isFinite(vmax) ? vmax : null;
  const vmaxUncorrected =
    typeof uncorrected === 'number' && Number.isFinite(uncorrected) ? uncorrected : null;
  const calibratedLabel = getPanEchoCalibratedAsLabel(diagnoses);
  if (severe === null && any === null && vmaxEstimate === null && calibratedLabel === null) {
    return null;
  }
  return { severe, any, vmaxEstimate, calibratedLabel, vmaxUncorrected };
}

export type PanEchoOutputGroup = 'leftVentricle' | 'rightHeart' | 'atria' | 'valves' | 'other';

export interface PanEchoOutputDefinition {
  key: string;
  label: string;
  unit?: string;
  group: PanEchoOutputGroup;
}

export const PAN_ECHO_OUTPUTS: readonly PanEchoOutputDefinition[] = [
  {
    key: 'Left ventricular (LV) ejection fraction',
    label: 'LV ejection fraction',
    unit: '%',
    group: 'leftVentricle',
  },
  {
    key: 'Global longitudinal strain',
    label: 'Global longitudinal strain',
    unit: '%',
    group: 'leftVentricle',
  },
  {
    key: 'LV end-diastolic volume',
    label: 'LV end-diastolic volume',
    unit: 'mL',
    group: 'leftVentricle',
  },
  {
    key: 'LV end-systolic volume',
    label: 'LV end-systolic volume',
    unit: 'mL',
    group: 'leftVentricle',
  },
  {
    key: 'LV stroke volume',
    label: 'LV stroke volume',
    unit: 'mL',
    group: 'leftVentricle',
  },
  { key: 'LV size', label: 'LV size', group: 'leftVentricle' },
  {
    key: 'Any level of LV hypertrophy (increased wall thickness)',
    label: 'LV hypertrophy',
    group: 'leftVentricle',
  },
  {
    key: 'Moderate or greater LV hypertrophy (increased wall thickness)',
    label: 'Moderate or greater LV hypertrophy',
    group: 'leftVentricle',
  },
  { key: 'LV systolic function', label: 'LV systolic function', group: 'leftVentricle' },
  {
    key: 'LV wall motion abnormalities',
    label: 'LV wall motion abnormalities',
    group: 'leftVentricle',
  },
  {
    key: 'LV intraventricular septum thickness at diastole',
    label: 'Septal thickness at diastole',
    unit: 'cm',
    group: 'leftVentricle',
  },
  {
    key: 'LV posterior wall thickness at diastole',
    label: 'Posterior wall thickness at diastole',
    unit: 'cm',
    group: 'leftVentricle',
  },
  {
    key: 'LV internal diameter at systole',
    label: 'LV internal diameter at systole',
    unit: 'cm',
    group: 'leftVentricle',
  },
  {
    key: 'LV internal diameter at diastole',
    label: 'LV internal diameter at diastole',
    unit: 'cm',
    group: 'leftVentricle',
  },
  {
    key: 'LV outflow tract diameter',
    label: 'LV outflow tract diameter',
    unit: 'cm',
    group: 'leftVentricle',
  },
  {
    key: 'LV diastolic function',
    label: 'LV diastolic function',
    group: 'leftVentricle',
  },
  { key: "E/e' ratio", label: "E/e' ratio", unit: 'ratio', group: 'leftVentricle' },
  {
    key: 'Right ventricular (RV) systolic pressure',
    label: 'RV systolic pressure',
    unit: 'mmHg',
    group: 'rightHeart',
  },
  { key: 'RV size', label: 'RV size', group: 'rightHeart' },
  { key: 'RV systolic function', label: 'RV systolic function', group: 'rightHeart' },
  {
    key: 'RV internal diameter at diastole',
    label: 'RV internal diameter at diastole',
    unit: 'cm',
    group: 'rightHeart',
  },
  {
    key: 'Tricuspid annular plane systolic excursion',
    label: 'Tricuspid annular plane systolic excursion',
    unit: 'cm',
    group: 'rightHeart',
  },
  {
    key: "RV systolic excursion velocity (RV S')",
    label: "RV systolic excursion velocity (RV S')",
    unit: 'cm/s',
    group: 'rightHeart',
  },
  { key: 'Left atrial (LA) size', label: 'Left atrial size', group: 'atria' },
  {
    key: 'LA internal diameter at systole',
    label: 'LA internal diameter at systole',
    unit: 'cm',
    group: 'atria',
  },
  { key: 'LA volume', label: 'LA volume', unit: 'mL', group: 'atria' },
  { key: 'Right atrial (RA) size', label: 'Right atrial size', group: 'atria' },
  { key: 'RA major dimension', label: 'RA major dimension', unit: 'cm', group: 'atria' },
  { key: 'Elevated RA pressure', label: 'Elevated RA pressure', group: 'atria' },
  { key: 'Bicuspid aortic valve', label: 'Bicuspid aortic valve', group: 'valves' },
  { key: 'Aortic valve stenosis', label: 'Aortic valve stenosis', group: 'valves' },
  {
    key: 'Aortic valve peak velocity',
    label: 'Aortic valve peak velocity',
    unit: 'm/s',
    group: 'valves',
  },
  { key: 'Aortic valve regurgitation', label: 'Aortic valve regurgitation', group: 'valves' },
  {
    key: 'Elevated LV outflow tract pressure',
    label: 'Elevated LV outflow tract pressure',
    group: 'valves',
  },
  { key: 'Mitral valve stenosis', label: 'Mitral valve stenosis', group: 'valves' },
  { key: 'Mitral valve regurgitation', label: 'Mitral valve regurgitation', group: 'valves' },
  {
    key: 'Tricuspid valve regurgitation',
    label: 'Tricuspid valve regurgitation',
    group: 'valves',
  },
  {
    key: 'Tricuspid valve peak gradient',
    label: 'Tricuspid valve peak gradient',
    unit: 'mmHg',
    group: 'valves',
  },
  {
    key: 'Pericardial effusion',
    label: 'Pericardial effusion',
    group: 'other',
  },
  {
    key: 'Transverse aortic root diameter',
    label: 'Transverse aortic root diameter',
    unit: 'cm',
    group: 'other',
  },
] as const;

export interface PanEchoResultPayload {
  diagnosis: string | null;
  diagnoses: Record<string, string>;
  predictions: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDiagnoses(value: unknown): Record<string, string> {
  if (typeof value !== 'string') {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      return {};
    }

    const diagnoses: Record<string, string> = {};
    for (const [key, diagnosis] of Object.entries(parsed)) {
      if (typeof diagnosis === 'string') {
        diagnoses[key] = diagnosis;
      }
    }
    return diagnoses;
  } catch {
    return {};
  }
}

export function parsePanEchoResultPayload(value: unknown): PanEchoResultPayload | null {
  if (!isRecord(value) || !isRecord(value.predictions)) {
    return null;
  }

  const diagnosis = typeof value.diagnosis === 'string' ? value.diagnosis : null;
  return {
    diagnosis,
    diagnoses: parseDiagnoses(diagnosis),
    predictions: value.predictions,
  };
}
