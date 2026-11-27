// "echo-sr-measurements" is not a model: study-service reads the sonographer's
// measurements from the echo DICOM SR (cardio-agent study-service
// src/services/echo_sr.py) and stores them like a model result.
export const ECHO_SR_MODEL_NAME = 'echo-sr-measurements';

// Every 1.0.x release keeps the echo-sr-measurements/1 schema.
export function isSupportedEchoSrVersion(version: string | null | undefined): boolean {
  return typeof version === 'string' && /^1\.0(\.\d+)?$/.test(version.trim());
}

export interface EchoSrValue {
  value: number;
  unit: string;
  method?: string;
  mode?: string;
  site?: string;
  rule?: string;
  otherMethods?: { method: string; value: number }[];
}

export const ECHO_SR_SUMMARY_KEYS = [
  'avVmax',
  'avMeanGradient',
  'avPeakGradient',
  'avVti',
  'ava',
  'avaVti',
  'avaVmax',
  'avaPlanimetry',
  'lvotDiameter',
  'lvotVti',
  'lvotVmax',
  'lvef',
  'trPeakGradient',
  'trVmax',
  'mvE',
  'mvA',
  'mvEA',
  'ePrimeSeptal',
  'ePrimeLateral',
  'eOverEPrime',
  'tapse',
] as const;

export type EchoSrSummaryKey = (typeof ECHO_SR_SUMMARY_KEYS)[number];
export type EchoSrSummary = Partial<Record<EchoSrSummaryKey, EchoSrValue>>;

export interface EchoSrMeasurement {
  site: string;
  measurement: string;
  value: number;
  unit: string;
  code?: string;
  method?: string;
  mode?: string;
  flowDirection?: string;
  cardiacPhase?: string;
  view?: string;
  samples?: number;
  rule?: string;
}

export type EchoSrGrade = 'severe' | 'moderate' | 'mild' | 'none' | 'none_or_mild';

export interface EchoSrAsGrading {
  grade: EchoSrGrade;
  label: string;
  labelFr: string | null;
  basis: string[];
  derivedFrom: string;
  guideline: string | null;
  note: string | null;
  ava: EchoSrValue | null;
  avaNote: string | null;
  discordant: boolean;
}

export interface EchoSrSourceDocument {
  manufacturer: string;
  model: string;
  template: string | null;
  measurementCount: number | null;
}

export interface EchoSrResultPayload {
  schema: string;
  source: { srCount: number; documents: EchoSrSourceDocument[] };
  measurements: EchoSrMeasurement[];
  summary: EchoSrSummary;
  asGrading: EchoSrAsGrading | null;
  diagnosis: Record<string, string>;
  rules: Record<string, string>;
}

const GRADES: readonly EchoSrGrade[] = ['severe', 'moderate', 'mild', 'none', 'none_or_mild'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseValue(value: unknown): EchoSrValue | null {
  if (!isRecord(value)) {
    return null;
  }
  const number = finite(value.value);
  if (number === null) {
    return null;
  }
  const parsed: EchoSrValue = {
    value: number,
    unit: typeof value.unit === 'string' ? value.unit : '',
  };
  for (const key of ['method', 'mode', 'site', 'rule'] as const) {
    const field = text(value[key]);
    if (field) {
      parsed[key] = field;
    }
  }
  if (Array.isArray(value.otherMethods)) {
    const others = value.otherMethods.flatMap(item =>
      isRecord(item) && text(item.method) && finite(item.value) !== null
        ? [{ method: item.method as string, value: item.value as number }]
        : []
    );
    if (others.length) {
      parsed.otherMethods = others;
    }
  }
  return parsed;
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') {
      out[key] = item;
    }
  }
  return out;
}

function parseGrading(value: unknown): EchoSrAsGrading | null {
  if (!isRecord(value) || !GRADES.includes(value.grade as EchoSrGrade) || !text(value.label)) {
    return null;
  }
  return {
    grade: value.grade as EchoSrGrade,
    label: value.label as string,
    labelFr: text(value.labelFr) ?? null,
    basis: Array.isArray(value.basis)
      ? value.basis.filter((b): b is string => typeof b === 'string')
      : [],
    derivedFrom: text(value.derivedFrom) ?? 'measurements',
    guideline: text(value.guideline) ?? null,
    note: text(value.note) ?? null,
    ava: parseValue(value.ava),
    avaNote: text(value.avaNote) ?? null,
    discordant: value.discordant === true,
  };
}

function parseMeasurement(value: unknown): EchoSrMeasurement | null {
  if (!isRecord(value) || !text(value.measurement) || finite(value.value) === null) {
    return null;
  }
  const measurement: EchoSrMeasurement = {
    site: text(value.site) ?? '',
    measurement: value.measurement as string,
    value: value.value as number,
    unit: typeof value.unit === 'string' ? value.unit : '',
  };
  for (const key of [
    'code',
    'method',
    'mode',
    'flowDirection',
    'cardiacPhase',
    'view',
    'rule',
  ] as const) {
    const field = text(value[key]);
    if (field) {
      measurement[key] = field;
    }
  }
  const samples = finite(value.samples);
  if (samples !== null) {
    measurement.samples = samples;
  }
  return measurement;
}

export function parseEchoSrResultPayload(value: unknown): EchoSrResultPayload | null {
  if (
    !isRecord(value) ||
    typeof value.schema !== 'string' ||
    !value.schema.startsWith('echo-sr-measurements/')
  ) {
    return null;
  }
  const summary: EchoSrSummary = {};
  if (isRecord(value.summary)) {
    for (const key of ECHO_SR_SUMMARY_KEYS) {
      const parsed = parseValue(value.summary[key]);
      if (parsed) {
        summary[key] = parsed;
      }
    }
  }
  const source = isRecord(value.source) ? value.source : {};
  const documents = Array.isArray(source.documents)
    ? source.documents.flatMap(document =>
        isRecord(document)
          ? [
              {
                manufacturer: text(document.manufacturer) ?? '',
                model: text(document.model) ?? '',
                template: text(document.template) ?? null,
                measurementCount: finite(document.measurementCount),
              },
            ]
          : []
      )
    : [];
  return {
    schema: value.schema,
    source: { srCount: finite(source.srCount) ?? documents.length, documents },
    measurements: Array.isArray(value.measurements)
      ? value.measurements
          .map(parseMeasurement)
          .filter((item): item is EchoSrMeasurement => item !== null)
      : [],
    summary,
    asGrading: parseGrading(value.asGrading),
    diagnosis: stringMap(value.diagnosis),
    rules: stringMap(value.rules),
  };
}

// Units as written in the result ("cm2") shown with typography ("cm²").
export function displayUnit(unit: string): string {
  return unit.replace(/2$/, '²').replace(/3$/, '³');
}

export function formatEchoSrValue(item: EchoSrValue | null | undefined, digits = 2): string {
  if (!item) {
    return '—';
  }
  let rendered = item.value.toFixed(digits);
  if (rendered.includes('.')) {
    rendered = rendered.replace(/0+$/, '').replace(/\.$/, '');
  }
  const unit = displayUnit(item.unit);
  return unit ? `${rendered} ${unit}` : rendered;
}

// The grading label in the viewer's language (French when the language is fr*).
export function echoSrGradingLabel(grading: EchoSrAsGrading, language?: string | null): string {
  return language?.toLowerCase().startsWith('fr') && grading.labelFr
    ? grading.labelFr
    : grading.label;
}
