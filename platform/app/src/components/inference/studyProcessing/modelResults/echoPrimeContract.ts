export const ECHO_PRIME_MODEL_NAME = 'EchoPrime';
export const ECHO_PRIME_SUPPORTED_MODEL_VERSIONS = ['1.2.0'] as const;

export interface EchoPrimeBinaryDefinition {
  key: string;
  label: string;
  threshold: number;
}

export const ECHO_PRIME_BINARY_OUTPUTS: readonly EchoPrimeBinaryDefinition[] = [
  { key: 'pacemaker', label: 'Pacemaker', threshold: 0.1 },
  { key: 'impella', label: 'Impella device', threshold: 0.16 },
  { key: 'tavr', label: 'Transcatheter aortic valve', threshold: 0.76 },
  { key: 'mitraclip', label: 'MitraClip device', threshold: 0.2 },
  { key: 'aortic_stenosis', label: 'Moderate or severe aortic stenosis', threshold: 0.78 },
  {
    key: 'aortic_regurgitation',
    label: 'Moderate or severe aortic regurgitation',
    threshold: 0.16,
  },
  { key: 'dilated_ivc', label: 'Dilated inferior vena cava', threshold: 0.32 },
  { key: 'left_atrium_dilation', label: 'Left atrial dilation', threshold: 0.16 },
  {
    key: 'mitral_annular_calcification',
    label: 'Moderate or severe mitral annular calcification',
    threshold: 0.32,
  },
  {
    key: 'mitral_regurgitation',
    label: 'Moderate or severe mitral regurgitation',
    threshold: 0.06,
  },
  {
    key: 'rv_systolic_function_depressed',
    label: 'Depressed RV systolic function',
    threshold: 0.04,
  },
  { key: 'right_ventricle_dilation', label: 'Right ventricular dilation', threshold: 0.14 },
  {
    key: 'tricuspid_valve_regurgitation',
    label: 'Moderate or severe tricuspid regurgitation',
    threshold: 0.26,
  },
  {
    key: 'elevated_left_atrial_pressure',
    label: 'Elevated left atrial pressure',
    threshold: 0.3,
  },
  { key: 'wall_motion_hypokinesis', label: 'Wall-motion hypokinesis', threshold: 0.24 },
  {
    key: 'atrial_septum_hypertrophy',
    label: 'Atrial septal hypertrophy',
    threshold: 1.06,
  },
] as const;

export const ECHO_PRIME_CONTINUOUS_OUTPUTS = [
  { key: 'ejection_fraction', label: 'LV ejection fraction', unit: '%' },
  {
    key: 'pulmonary_artery_pressure_continuous',
    label: 'Pulmonary artery systolic pressure',
    unit: 'mmHg',
  },
] as const;

export interface EchoPrimeResultPayload {
  diagnosis: string | null;
  predictions: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseEchoPrimeResultPayload(value: unknown): EchoPrimeResultPayload | null {
  if (!isRecord(value) || !isRecord(value.predictions)) {
    return null;
  }

  return {
    diagnosis: typeof value.diagnosis === 'string' ? value.diagnosis : null,
    predictions: value.predictions,
  };
}
