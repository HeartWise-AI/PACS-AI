// EchoAlign (research use only, CC BY-NC 4.0): MBZUAI BioMedIA / iCardio.ai / DKFZ,
// arXiv:2611.27517. PACS-AI runs the authors' released linear probes on the study
// embedding (model-examples/EchoAlign). The result is presented with the PanEcho layout,
// plus a research-use banner.
export const ECHO_ALIGN_MODEL_NAME = 'EchoAlign (research use only)';
export const ECHO_ALIGN_SUPPORTED_RELEASE_LINES = ['0.1'] as const;

export function isSupportedEchoAlignVersion(version: string | null | undefined): boolean {
  if (typeof version !== 'string') {
    return false;
  }
  const match = version.trim().match(/^(\d+\.\d+)\.\d+$/);
  return !!match && ECHO_ALIGN_SUPPORTED_RELEASE_LINES.some(line => line === match[1]);
}

export type EchoAlignHead =
  | { type: 'classification'; probability: number; threshold: number; called: boolean }
  | {
      type: 'ordinal';
      probabilities: Record<string, number>;
      grade: string;
      gradeIndex: number;
      expectedGrade?: number;
    }
  | { type: 'regression'; value: number; unit?: string };

export interface EchoAlignResultPayload {
  diagnosis: string | null;
  heads: Record<string, EchoAlignHead>;
  clipsUsed: number | null;
}

// Same groups as PanEcho.
export type EchoAlignOutputGroup = 'leftVentricle' | 'rightHeart' | 'atria' | 'valves' | 'other';

export interface EchoAlignOutputDefinition {
  head: string;
  // PanEcho's label where PanEcho has the same finding; EchoAlign-only outputs get their own.
  label: string;
  unit?: string;
  group: EchoAlignOutputGroup;
  // Binary heads: what a called / not-called finding means for this label.
  called?: string;
  notCalled?: string;
}

// Order and labels follow PAN_ECHO_OUTPUTS; EchoAlign-only outputs sit in the matching section.
export const ECHO_ALIGN_OUTPUTS: readonly EchoAlignOutputDefinition[] = [
  { head: 'ejection_fraction', label: 'LV ejection fraction', unit: '%', group: 'leftVentricle' },
  { head: 'lv_enlargement_grade', label: 'LV size', group: 'leftVentricle' },
  { head: 'lvh_grade', label: 'LV hypertrophy', group: 'leftVentricle' },
  { head: 'lv_systolic_dysfunction_grade', label: 'LV systolic function', group: 'leftVentricle' },
  {
    head: 'rwma',
    label: 'LV wall motion abnormalities',
    group: 'leftVentricle',
    called: 'Present',
    notCalled: 'Absent',
  },
  {
    head: 'septal_motion_abnormality',
    label: 'Septal motion abnormality',
    group: 'leftVentricle',
    called: 'Present',
    notCalled: 'Absent',
  },
  {
    head: 'lv_diastolic_dysfunction_grade',
    label: 'LV diastolic function',
    group: 'leftVentricle',
  },
  { head: 'rvsp', label: 'RV systolic pressure', unit: 'mmHg', group: 'rightHeart' },
  {
    head: 'rv_enlargement',
    label: 'RV size',
    group: 'rightHeart',
    called: 'Enlarged',
    notCalled: 'Normal',
  },
  {
    head: 'rv_systolic_dysfunction',
    label: 'RV systolic function',
    group: 'rightHeart',
    called: 'Reduced',
    notCalled: 'Normal',
  },
  { head: 'pa_pressure', label: 'Pulmonary artery pressure', unit: 'mmHg', group: 'rightHeart' },
  { head: 'pulmonary_hypertension_grade', label: 'Pulmonary hypertension', group: 'rightHeart' },
  { head: 'la_enlargement_grade', label: 'Left atrial size', group: 'atria' },
  { head: 'lavi', label: 'LA volume index', unit: 'mL/m²', group: 'atria' },
  {
    head: 'ra_enlargement',
    label: 'Right atrial size',
    group: 'atria',
    called: 'Enlarged',
    notCalled: 'Normal',
  },
  {
    head: 'elevated_ra_pressure',
    label: 'Elevated RA pressure',
    group: 'atria',
    called: 'Elevated',
    notCalled: 'Not elevated',
  },
  {
    head: 'ivc_dilation',
    label: 'IVC dilation',
    group: 'atria',
    called: 'Dilated',
    notCalled: 'Not dilated',
  },
  {
    head: 'bicuspid_av',
    label: 'Bicuspid aortic valve',
    group: 'valves',
    called: 'Bicuspid',
    notCalled: 'Not detected',
  },
  {
    head: 'transaortic_mean_gradient',
    label: 'Aortic valve mean gradient (AI estimate)',
    unit: 'mmHg',
    group: 'valves',
  },
  {
    head: 'transaortic_peak_gradient',
    label: 'Aortic valve peak gradient (AI estimate)',
    unit: 'mmHg',
    group: 'valves',
  },
  {
    head: 'aortic_sclerosis',
    label: 'Aortic valve sclerosis',
    group: 'valves',
    called: 'Present',
    notCalled: 'Absent',
  },
  {
    head: 'aortic_valve_replacement',
    label: 'Aortic valve replacement',
    group: 'valves',
    called: 'Prosthetic valve',
    notCalled: 'Native valve',
  },
  { head: 'aortic_regurgitation_grade', label: 'Aortic valve regurgitation', group: 'valves' },
  {
    head: 'mitral_stenosis',
    label: 'Mitral valve stenosis',
    group: 'valves',
    called: 'Present',
    notCalled: 'Absent',
  },
  { head: 'mitral_regurgitation_grade', label: 'Mitral valve regurgitation', group: 'valves' },
  { head: 'mitral_calcification_grade', label: 'Mitral annular calcification', group: 'valves' },
  {
    head: 'mitral_valve_prolapse',
    label: 'Mitral valve prolapse',
    group: 'valves',
    called: 'Present',
    notCalled: 'Absent',
  },
  {
    head: 'tricuspid_regurgitation_grade',
    label: 'Tricuspid valve regurgitation',
    group: 'valves',
  },
  {
    head: 'pulmonic_regurgitation',
    label: 'Pulmonic valve regurgitation',
    group: 'valves',
    called: 'Present',
    notCalled: 'Absent',
  },
  { head: 'aortic_root_dimension', label: 'Aortic root diameter', unit: 'cm', group: 'other' },
  {
    head: 'ascending_aorta_dilation',
    label: 'Ascending aorta dilation',
    group: 'other',
    called: 'Dilated',
    notCalled: 'Not dilated',
  },
  {
    head: 'atrial_fibrillation',
    label: 'Atrial fibrillation',
    group: 'other',
    called: 'Present',
    notCalled: 'Absent',
  },
  { head: 'pacemaker', label: 'Pacemaker', group: 'other', called: 'Present', notCalled: 'Absent' },
] as const;

// Shown in the aortic stenosis screening block, never as a diagnosis row.
export const ECHO_ALIGN_AS_GRADE = 'aortic_stenosis_grade';
export const ECHO_ALIGN_AS_CLASSIFIER = 'aortic_stenosis_classification';
export const ECHO_ALIGN_AV_VMAX = 'transaortic_peak_velocity';

export interface EchoAlignAorticScreening {
  // P(severe) and P(mild, moderate or severe) from the AS grade head, 0..1.
  severe: number | null;
  any: number | null;
  vmaxEstimate: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function probability(value: unknown): number | null {
  const number = finite(value);
  return number !== null && number >= 0 && number <= 1 ? number : null;
}

function parseHead(value: unknown): EchoAlignHead | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.type === 'classification') {
    const p = probability(value.probability);
    const threshold = probability(value.threshold);
    return p === null || threshold === null
      ? null
      : { type: 'classification', probability: p, threshold, called: value.called === true };
  }
  if (
    value.type === 'ordinal' &&
    isRecord(value.probabilities) &&
    typeof value.grade === 'string'
  ) {
    const probabilities: Record<string, number> = {};
    for (const [name, p] of Object.entries(value.probabilities)) {
      const parsed = probability(p);
      if (parsed !== null) {
        probabilities[name] = parsed;
      }
    }
    return {
      type: 'ordinal',
      probabilities,
      grade: value.grade,
      gradeIndex: finite(value.gradeIndex) ?? 0,
    };
  }
  if (value.type === 'regression') {
    const number = finite(value.value);
    return number === null
      ? null
      : {
          type: 'regression',
          value: number,
          unit: typeof value.unit === 'string' ? value.unit : undefined,
        };
  }
  return null;
}

export function parseEchoAlignResultPayload(value: unknown): EchoAlignResultPayload | null {
  if (!isRecord(value) || !isRecord(value.predictions)) {
    return null;
  }
  const predictions = value.predictions;
  const source = isRecord(predictions.allHeads)
    ? predictions.allHeads
    : isRecord(predictions.keyHeads)
      ? predictions.keyHeads
      : null;
  if (!source) {
    return null;
  }
  const heads: Record<string, EchoAlignHead> = {};
  for (const [name, head] of Object.entries(source)) {
    const parsed = parseHead(head);
    if (parsed) {
      heads[name] = parsed;
    }
  }
  return {
    diagnosis: typeof value.diagnosis === 'string' ? value.diagnosis : null,
    heads,
    clipsUsed: finite(predictions.clipsUsed),
  };
}

export function getEchoAlignAorticScreening(
  payload: EchoAlignResultPayload
): EchoAlignAorticScreening | null {
  const grade = payload.heads[ECHO_ALIGN_AS_GRADE];
  const vmax = payload.heads[ECHO_ALIGN_AV_VMAX];
  let severe: number | null = null;
  let any: number | null = null;
  if (grade?.type === 'ordinal') {
    severe = probability(grade.probabilities.severe);
    const normal = probability(grade.probabilities.normal);
    any = normal === null ? null : Math.max(0, Math.min(1, 1 - normal));
  }
  const vmaxEstimate = vmax?.type === 'regression' ? vmax.value : null;
  if (severe === null && any === null && vmaxEstimate === null) {
    return null;
  }
  return { severe, any, vmaxEstimate };
}
