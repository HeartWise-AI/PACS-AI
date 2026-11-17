export const PAN_ECHO_MODEL_NAME = 'PanEcho';

// 1.0.0 is the model package contract. The worklist fixture currently reports
// 1.4.0 with the same JSON output shape, so both are intentionally explicit.
export const PAN_ECHO_SUPPORTED_MODEL_VERSIONS = ['1.0.0', '1.4.0'] as const;

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
