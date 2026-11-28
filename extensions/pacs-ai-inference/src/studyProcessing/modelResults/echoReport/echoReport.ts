// Structured echo report: sections in standard echo order, measured SR values first, then AI
// estimates, and a conclusion listing only positive, actionable findings by structure.
//
// TypeScript port of pacs-ai-backend model-examples/PanEcho/utils/echo_report.py (the same
// module serves the PanEcho / EchoAlign HTML reports and CardioAgent's chat summary). Cut-offs,
// routing and wording live in echo_report_thresholds.json (versioned, with references): change
// them there, in every copy, never here. echoReport.parity.test.ts checks this port against the
// Python outputs.
import thresholds from './echo_report_thresholds.json';

export type Lang = 'en' | 'fr';
export type Bilingual = { en: string; fr: string };
type Rec = Record<string, unknown>;

export const ECHO_REPORT_SCHEMA = 'echo-structured-report/1';
export const MODEL_PANECHO = 'PanEcho';
export const MODEL_ECHOALIGN = 'EchoAlign';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EchoReportConfig = any;
export const ECHO_REPORT_CONFIG: EchoReportConfig = thresholds;

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  if (typeof value === 'boolean' || value === null || value === undefined) {
    return null;
  }
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

export function modelFamily(modelName: string | null | undefined): string | null {
  const name = (modelName ?? '').toLowerCase();
  if (name.startsWith('echoalign')) {
    return MODEL_ECHOALIGN;
  }
  if (name.startsWith('panecho')) {
    return MODEL_PANECHO;
  }
  return null;
}

export function normalizeSex(sex: unknown): 'male' | 'female' | null {
  const text = String(sex ?? '').trim().toLowerCase();
  if (['m', 'male', 'man', 'homme', 'h'].includes(text)) {
    return 'male';
  }
  if (['f', 'female', 'woman', 'femme'].includes(text)) {
    return 'female';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Formatting (Python semantics: correctly rounded, exact binary ties to even)
// ---------------------------------------------------------------------------------------------

function toFixedPy(value: number, digits: number): string {
  const scaled = value * 10 ** digits;
  if (Number.isInteger(scaled * 2) && !Number.isInteger(scaled)) {
    // Exact tie (e.g. 1.25 to 1 digit): Python rounds half to even.
    const floor = Math.floor(scaled);
    const even = floor % 2 === 0 ? floor : floor + 1;
    return (even / 10 ** digits).toFixed(digits);
  }
  const text = value.toFixed(digits);
  return text === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : text;
}

export function roundPy(value: number, digits: number): number {
  return Number(toFixedPy(value, digits));
}

export function formatNumber(value: number, digits: number, lang: Lang = 'en'): string {
  const text = toFixedPy(value, digits);
  return lang === 'fr' ? text.replace('.', ',') : text;
}

export function formatValue(value: number, unit: string | null | undefined, digits: number, lang: Lang = 'en'): string {
  const u = (unit ?? '').trim();
  const text = formatNumber(value, digits, lang);
  return u ? `${text} ${u}` : text;
}

export function formatPercent(probability: number | null | undefined): string | null {
  if (probability === null || probability === undefined) {
    return null;
  }
  const pct = probability * 100;
  if (pct > 0 && pct < 1) {
    return '<1 %';
  }
  return `${roundPy(pct, 0).toFixed(0)} %`;
}

function digitsFor(unit: string): number {
  if (['m/s', 'cm', 'cm2', 'cm²', 'm²'].includes(unit)) {
    return 2;
  }
  if (['%', 'mmHg', 'ml', 'mL', 'ms', '1/min', 'l/min'].includes(unit)) {
    return 0;
  }
  return 1;
}

function unitDisplay(unit: unknown): string {
  const u = String(unit ?? '');
  const map: Record<string, string> = {
    cm2: 'cm²',
    ml: 'mL',
    'ml/m2': 'mL/m²',
    m2: 'm²',
    '(l/min)/m2': 'L/min/m²',
    'l/min': 'L/min',
  };
  return map[u] ?? u;
}

// ---------------------------------------------------------------------------------------------
// SR routing by Finding Site
// ---------------------------------------------------------------------------------------------

/** Section id of one echo-sr measurement, or null when it is not shown (patient data). */
export function routeSrMeasurement(entry: Rec, cfg: EchoReportConfig = ECHO_REPORT_CONFIG): string | null {
  const routing = cfg.srRouting;
  const site = String(entry.site ?? '').trim().toLowerCase();
  const name = String(entry.measurement ?? '').trim().toLowerCase();
  for (const override of routing.measurementOverrides ?? []) {
    if (name.includes(override.contains) && (!override.site || override.site === site)) {
      return override.section;
    }
  }
  if (Object.prototype.hasOwnProperty.call(routing.sites, site)) {
    return routing.sites[site];
  }
  for (const pattern of routing.sitePatterns ?? []) {
    if (site.includes(pattern.contains)) {
      return pattern.section;
    }
  }
  if (!site || (routing.ignoredSites ?? []).includes(site)) {
    return null;
  }
  return 'other';
}

const GENERIC_NAMES = new Set([
  'peak velocity', 'peak gradient', 'mean gradient', 'velocity time integral', 'diameter',
  'cardiovascular orifice area', 'cardiovascular orifice diameter', 'pressure half-time',
  'deceleration time', 'volume flow', 'flow radius', 'alias velocity', 'stroke volume',
  'cardiac output', 'cardiac index', 'peak tissue velocity', 'mean velocity',
  'peak instantaneous flow rate', 'acceleration time', 'deceleration slope',
  'acceleration slope', 'ejection time', 'stroke index', 'area', 'distance',
]);

function measurementLabel(entry: Rec): string {
  let label = String(entry.measurement ?? '');
  const qualifiers = ['method', 'flowDirection', 'mode', 'view']
    .filter(key => entry[key])
    .map(key => String(entry[key]));
  const site = String(entry.site ?? '');
  if (GENERIC_NAMES.has(label.toLowerCase()) && site) {
    label = `${site} ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
  }
  if (qualifiers.length) {
    label = `${label} (${qualifiers.join(', ')})`;
  }
  return label;
}

// ---------------------------------------------------------------------------------------------
// Measured metrics and rules
// ---------------------------------------------------------------------------------------------

export interface MetricValue {
  value: number;
  unit: string;
  label: Bilingual;
  digits: number;
  method?: string | null;
  derived?: boolean;
  from?: string;
}

function isRegurgitant(entry: Rec): boolean {
  return String(entry.flowDirection ?? '').toLowerCase().includes('regurg');
}

function metricFromMeasurements(spec: Rec, measurements: Rec[]): { value: number; method: unknown } | null {
  const sites = ((spec.site as string[]) ?? []).map(s => s.toLowerCase());
  const names = ((spec.measurement as string[]) ?? []).map(n => n.toLowerCase());
  const prefix = String(spec.measurementPrefix ?? '').toLowerCase();
  const found: Rec[] = [];
  for (const entry of measurements) {
    const site = String(entry.site ?? '').toLowerCase();
    const name = String(entry.measurement ?? '').toLowerCase();
    if (sites.length && !sites.includes(site)) continue;
    if (names.length && !names.includes(name)) continue;
    if (prefix && !name.startsWith(prefix)) continue;
    if (!names.length && !prefix) continue;
    if (spec.antegrade && isRegurgitant(entry)) continue;
    if (finite(entry.value) === null) continue;
    found.push(entry);
  }
  if (!found.length) {
    return null;
  }
  let chosen: Rec | null = null;
  for (const word of (spec.prefer as string[]) ?? []) {
    const matching = found.filter(e => String(e.method ?? '').toLowerCase().includes(word));
    if (matching.length) {
      chosen = matching[0];
      break;
    }
  }
  if (!chosen) {
    chosen = spec.max
      ? found.reduce((best, e) => (Number(e.value) > Number(best.value) ? e : best), found[0])
      : found[0];
  }
  return { value: Number(chosen.value), method: chosen.method };
}

/** Graded values read from an echo-sr-measurements result. */
export function measuredMetrics(measured: unknown, cfg: EchoReportConfig = ECHO_REPORT_CONFIG): Record<string, MetricValue> {
  if (!isRecord(measured)) {
    return {};
  }
  const summary = isRecord(measured.summary) ? measured.summary : {};
  const measurements = Array.isArray(measured.measurements) ? measured.measurements.filter(isRecord) : [];
  const out: Record<string, MetricValue> = {};
  for (const [metric, spec] of Object.entries<Rec>(cfg.metrics)) {
    if (metric === 'comment') continue;
    let found: { value: number; method: unknown } | null = null;
    if (spec.summary) {
      const item = summary[spec.summary as string];
      if (isRecord(item) && finite(item.value) !== null) {
        found = { value: Number(item.value), method: item.method };
      }
    } else {
      found = metricFromMeasurements(spec, measurements);
    }
    if (!found) continue;
    let value = found.value * Number(spec.scale ?? 1.0);
    if (spec.abs) {
      value = Math.abs(value);
    }
    out[metric] = {
      value,
      unit: (spec.unit as string) ?? '',
      label: spec.label as Bilingual,
      digits: (spec.digits as number) ?? 1,
      method: (found.method as string) ?? null,
    };
  }
  for (const [metric, spec] of Object.entries<Rec>(cfg.derivedMetrics ?? {})) {
    if (metric === 'comment') continue;
    if (spec.prefer && out[spec.prefer as string]) {
      const base = out[spec.prefer as string];
      out[metric] = { ...base, label: spec.label as Bilingual, unit: spec.unit as string, digits: spec.digits as number };
      continue;
    }
    if (spec.maxOf) {
      const parts = (spec.maxOf as string[]).filter(m => out[m]).map(m => [m, out[m]] as const);
      if (parts.length) {
        const [name, best] = parts.reduce((a, b) => (b[1].value > a[1].value ? b : a), parts[0]);
        out[metric] = {
          value: best.value,
          unit: spec.unit as string,
          label: best.label,
          digits: spec.digits as number,
          method: null,
          from: name,
        };
      }
      continue;
    }
    const num = out[(spec.numerator as string) ?? ''];
    const den = out[(spec.denominator as string) ?? ''];
    if (num && den && den.value > 0) {
      out[metric] = {
        value: num.value / den.value,
        unit: spec.unit as string,
        label: spec.label as Bilingual,
        digits: spec.digits as number,
        method: null,
        derived: true,
      };
    }
  }
  return out;
}

function cutsFor(rule: Rec, sex: string | null): number[] {
  const cuts = (rule.cuts ?? {}) as Record<string, number[]>;
  if (cuts.any) {
    return [...cuts.any];
  }
  return [...(cuts[sex ?? 'male'] ?? cuts.male ?? [])];
}

/** 0 when normal, else the 1-based level of the most severe cut crossed (value compared as displayed). */
export function gradeValue(rule: Rec, value: number, sex: string | null, digits?: number | null): number {
  const v = digits === null || digits === undefined ? value : roundPy(value, digits);
  let level = 0;
  cutsFor(rule, sex).forEach((cut, index) => {
    const compare = rule.compare;
    const crossed =
      (compare === 'gt' && v > cut) ||
      (compare === 'ge' && v >= cut) ||
      (compare === 'lt' && v < cut) ||
      (compare === 'le' && v <= cut);
    if (crossed) {
      level = index + 1;
    }
  });
  return level;
}

function metricText(metric: MetricValue, lang: Lang): string {
  let text = `${metric.label[lang]} ${formatValue(metric.value, metric.unit, metric.digits ?? 1, lang)}`;
  if (metric.method) {
    text += ` (${metric.method})`;
  }
  return text;
}

function asValuesText(measured: Rec, lang: Lang): string {
  const summary = isRecord(measured.summary) ? measured.summary : {};
  const parts: string[] = [];
  const spec: [string, string, number, string][] = [
    ['avVmax', 'Vmax', 2, 'm/s'],
    ['avMeanGradient', lang === 'en' ? 'MG' : 'GM', 0, 'mmHg'],
    ['ava', lang === 'en' ? 'AVA' : 'SVA', 2, 'cm²'],
  ];
  for (const [key, label, digits, unit] of spec) {
    const item = summary[key];
    const value = isRecord(item) ? finite(item.value) : null;
    if (value !== null) {
      parts.push(`${label} ${formatValue(value, unit, digits, lang)}`);
    }
  }
  return parts.join(', ');
}

export interface MeasuredFinding {
  ruleId: string;
  concept: string;
  structure: string;
  ref?: string | null;
  positive: boolean;
  level: number;
  label: Bilingual | null;
  values: Bilingual;
  value?: number;
  unit?: string;
  discordantGrading?: boolean;
  gradeLabel?: { en: string | null; fr: string | null };
}

export function measuredFindings(
  measured: unknown,
  sex: string | null = null,
  cfg: EchoReportConfig = ECHO_REPORT_CONFIG
): MeasuredFinding[] {
  if (!isRecord(measured)) {
    return [];
  }
  const metrics = measuredMetrics(measured, cfg);
  const findings: MeasuredFinding[] = [];
  for (const rule of cfg.measuredRules as Rec[]) {
    const base = {
      ruleId: rule.id as string,
      concept: rule.concept as string,
      structure: rule.structure as string,
      ref: (rule.ref as string) ?? null,
    };
    const labels = rule.labels as Bilingual[];
    if (rule.metric === 'asGrading') {
      const grading = measured.asGrading;
      if (!isRecord(grading) || !grading.grade) continue;
      const grade = String(grading.grade);
      const level = ({ mild: 1, moderate: 2, severe: 3 } as Record<string, number>)[grade] ?? 0;
      const discordant = !!grading.discordant;
      const texts = {} as Bilingual;
      for (const lang of ['en', 'fr'] as Lang[]) {
        const parts: string[] = [];
        if (level) parts.push(labels[level - 1][lang]);
        if (discordant) parts.push((rule.discordantLabel as Bilingual)[lang]);
        texts[lang] = parts.join('; ');
      }
      findings.push({
        ...base,
        positive: !!(level || discordant),
        level,
        discordantGrading: discordant,
        label: texts,
        values: { en: asValuesText(measured, 'en'), fr: asValuesText(measured, 'fr') },
        gradeLabel: {
          en: (grading.label as string) ?? null,
          fr: ((grading.labelFr as string) || (grading.label as string)) ?? null,
        },
      });
      continue;
    }
    const metric = metrics[rule.metric as string];
    if (!metric) continue;
    const level = gradeValue(rule, metric.value, sex, metric.digits);
    findings.push({
      ...base,
      positive: level > 0,
      level,
      label: level ? labels[level - 1] : null,
      values: { en: metricText(metric, 'en'), fr: metricText(metric, 'fr') },
      value: metric.value,
      unit: metric.unit,
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// AI findings and rows
// ---------------------------------------------------------------------------------------------

function parseDiagnoses(value: unknown): Record<string, string> {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!isRecord(parsed)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (typeof item === 'string') {
      out[key] = item;
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      out[key] = String(item);
    }
  }
  return out;
}

function panEchoParts(result: Rec) {
  const predictions = isRecord(result.predictions) ? result.predictions : {};
  const diagnoses = parseDiagnoses(result.diagnosis);
  const binaryRaw = isRecord(result.binaryProbabilities) ? result.binaryProbabilities : {};
  const binary: Record<string, number> = {};
  for (const [key, value] of Object.entries(binaryRaw)) {
    const n = finite(value);
    if (n !== null) binary[key] = n;
  }
  const screening = isRecord(result.asScreening) ? result.asScreening : null;
  return { predictions, diagnoses, binary, screening };
}

function echoAlignHeads(result: Rec): Record<string, Rec> {
  const predictions = isRecord(result.predictions) ? result.predictions : {};
  const heads = isRecord(predictions.allHeads) ? predictions.allHeads : predictions.keyHeads;
  if (!isRecord(heads)) {
    return {};
  }
  const out: Record<string, Rec> = {};
  for (const [key, head] of Object.entries(heads)) {
    if (isRecord(head)) out[key] = head;
  }
  return out;
}

function ruleById(cfg: EchoReportConfig, id: string): Rec {
  const rule = (cfg.measuredRules as Rec[]).find(r => r.id === id);
  if (!rule) throw new Error(`unknown measured rule ${id}`);
  return rule;
}

function calibratedAsLabel(
  diagnoses: Record<string, string>,
  screening: Rec | null,
  labels: string[]
): string | null {
  const calibrated = screening ? screening.calibrated : null;
  if (isRecord(calibrated) && calibrated.label) {
    return String(calibrated.label);
  }
  const text = diagnoses['Aortic valve stenosis'] ?? '';
  const candidates = [...labels, 'No significant AS suspected'].sort((a, b) => b.length - a.length);
  for (const label of candidates) {
    if (text.startsWith(`${label} (MHI-calibrated`)) {
      return label;
    }
  }
  return null;
}

export interface AiFinding {
  key: string;
  kind: string;
  concept: string;
  structure: string;
  positive: boolean;
  text: Bilingual | null;
  probability?: number | null;
  threshold?: number | null;
  called?: string;
  calibrated?: boolean;
  value?: number;
  unit?: string;
  digits?: number;
  band?: number | null;
}

/** Evaluated AI rules (positive or not) for one model result. */
export function aiFindings(
  model: string,
  result: unknown,
  sex: string | null = null,
  cfg: EchoReportConfig = ECHO_REPORT_CONFIG
): AiFinding[] {
  const family = modelFamily(model) ?? model;
  const rules = (cfg.aiRules[family] ?? []) as Rec[];
  const res = isRecord(result) ? result : {};
  const out: AiFinding[] = [];
  if (family === MODEL_PANECHO) {
    const { predictions, diagnoses, binary, screening } = panEchoParts(res);
    for (const rule of rules) {
      const key = rule.key as string;
      const kind = rule.kind as string;
      const base = { key, kind, concept: rule.concept as string, structure: rule.structure as string };
      if (kind === 'multiclass') {
        const called = diagnoses[key];
        if (called === undefined) continue;
        const probs = predictions[key];
        const classes = rule.classes as string[];
        const positiveMap = rule.positive as Record<string, Bilingual>;
        let probability: number | null = null;
        if (Array.isArray(probs) && probs.length === classes.length) {
          probability = Object.keys(positiveMap).reduce(
            (sum, c) => sum + Number(probs[classes.indexOf(c)]),
            0
          );
        }
        const positive = Object.prototype.hasOwnProperty.call(positiveMap, called);
        out.push({ ...base, positive, text: positive ? positiveMap[called] : null, probability, called });
      } else if (kind === 'binary') {
        const called = diagnoses[key];
        if (called === undefined) continue;
        let probability: number | null = null;
        if (key in binary) {
          probability = rule.positiveIndex === 1 ? binary[key] : 1.0 - binary[key];
        }
        const positive = called === rule.positiveLabel;
        out.push({ ...base, positive, text: positive ? (rule.text as Bilingual) : null, probability, called });
      } else if (kind === 'regression') {
        const value = finite(predictions[key]);
        if (value === null) continue;
        const measuredRule = ruleById(cfg, rule.rule as string);
        const digits = (rule.digits as number) ?? 1;
        const level = gradeValue(measuredRule, value, sex, digits);
        out.push({
          ...base,
          positive: level > 0,
          text: level ? (measuredRule.labels as Bilingual[])[level - 1] : null,
          value,
          unit: (rule.unit as string) ?? '',
          digits,
          band: (rule.band as number) ?? null,
        });
      } else if (kind === 'asCalibrated') {
        const positiveLabels = rule.positiveLabels as string[];
        const label = calibratedAsLabel(diagnoses, screening, positiveLabels);
        if (label === null) continue;
        let probability = finite(screening?.pAny);
        const probs = predictions[key];
        if (probability === null && Array.isArray(probs) && probs.length === 3) {
          probability = Number(probs[0]) + Number(probs[2]);
        }
        const positive = positiveLabels.includes(label);
        out.push({
          ...base,
          positive,
          text: positive ? (rule.text as Record<string, Bilingual>)[label] ?? null : null,
          probability,
          called: label,
          calibrated: true,
        });
      }
    }
  } else if (family === MODEL_ECHOALIGN) {
    const heads = echoAlignHeads(res);
    for (const rule of rules) {
      const head = heads[rule.key as string];
      if (!head) continue;
      const kind = rule.kind as string;
      const base = {
        key: rule.key as string,
        kind,
        concept: rule.concept as string,
        structure: rule.structure as string,
      };
      if (kind === 'classification' && head.type === 'classification') {
        const positive = head.called === true;
        out.push({
          ...base,
          positive,
          text: positive ? (rule.text as Bilingual) : null,
          probability: finite(head.probability),
          threshold: finite(head.threshold),
        });
      } else if (kind === 'ordinal' && head.type === 'ordinal') {
        const grade = String(head.grade ?? '');
        const probs = isRecord(head.probabilities) ? head.probabilities : {};
        const positiveMap = rule.positive as Record<string, Bilingual>;
        const probability = Object.keys(probs).length
          ? Object.keys(positiveMap).reduce((sum, g) => sum + Number(probs[g] || 0), 0)
          : null;
        const positive = Object.prototype.hasOwnProperty.call(positiveMap, grade);
        out.push({ ...base, positive, text: positive ? positiveMap[grade] : null, probability, called: grade });
      } else if (kind === 'regression' && head.type === 'regression') {
        const value = finite(head.value);
        if (value === null) continue;
        const measuredRule = ruleById(cfg, rule.rule as string);
        const digits = (rule.digits as number) ?? 1;
        const level = gradeValue(measuredRule, value, sex, digits);
        out.push({
          ...base,
          positive: level > 0,
          text: level ? (measuredRule.labels as Bilingual[])[level - 1] : null,
          value,
          unit: (rule.unit as string) ?? '',
          digits,
          band: (rule.band as number) ?? null,
        });
      }
    }
  }
  return out;
}

function prettyClass(value: string): string {
  return value.split('|').join(' / ').split('_').join(' ');
}

export interface AiRow {
  key: string;
  section: string;
  label: Bilingual;
  display: string;
  value?: number;
  unit?: string;
  band?: number | null;
  probability?: number | null;
  threshold?: number | null;
  flagged?: boolean;
}

/** Display rows of every AI output, with their section (AS screening rows excluded). */
export function aiRows(model: string, result: unknown, cfg: EchoReportConfig = ECHO_REPORT_CONFIG): AiRow[] {
  const family = modelFamily(model) ?? model;
  const res = isRecord(result) ? result : {};
  const rows: AiRow[] = [];
  if (family === MODEL_PANECHO) {
    const { predictions, diagnoses } = panEchoParts(res);
    for (const spec of cfg.aiDisplay.PanEcho as Rec[]) {
      const key = spec.key as string;
      if (!(key in predictions) && !(key in diagnoses)) continue;
      const row: AiRow = {
        key,
        section: spec.section as string,
        label: { en: spec.en as string, fr: spec.fr as string },
        display: '',
      };
      const number = typeof predictions[key] === 'number' ? finite(predictions[key]) : null;
      if (number !== null && spec.unit !== undefined && spec.unit !== null) {
        row.value = number;
        row.unit = (spec.unit as string) ?? '';
        row.band = (spec.band as number) ?? null;
        row.display = formatValue(number, spec.unit as string, 1);
      } else {
        row.display = prettyClass(diagnoses[key] ?? '') || '—';
      }
      rows.push(row);
    }
  } else if (family === MODEL_ECHOALIGN) {
    const heads = echoAlignHeads(res);
    for (const spec of cfg.aiDisplay.EchoAlign as Rec[]) {
      const head = heads[spec.key as string];
      if (!head) continue;
      const row: AiRow = {
        key: spec.key as string,
        section: spec.section as string,
        label: { en: spec.en as string, fr: spec.fr as string },
        display: '',
      };
      if (head.type === 'regression' && finite(head.value) !== null) {
        const number = Number(head.value);
        const unit = (spec.unit as string) ?? (head.unit as string) ?? '';
        row.value = number;
        row.unit = unit;
        row.band = (spec.band as number) ?? null;
        row.display = formatValue(number, unit, 1);
      } else if (head.type === 'ordinal') {
        row.display = prettyClass(String(head.grade || '—'));
      } else if (head.type === 'classification') {
        row.display = head.called ? 'called' : 'not called';
        row.probability = finite(head.probability);
        row.threshold = finite(head.threshold);
      } else {
        continue;
      }
      rows.push(row);
    }
  }
  return rows;
}

export interface AsScreening {
  pSevere: number | null;
  pAny: number | null;
  vmax: number | null;
  vmaxUncorrected: number | null;
  vmaxBand: number | null;
  calibratedLabel: string | null;
  note?: Bilingual | null;
  grade?: string | null;
  pModerateOrSevere?: number | null;
  moderateOrSevereCalled?: boolean;
  threshold?: number | null;
}

/** AI aortic stenosis screening for the aortic valve subsection. */
export function asScreening(model: string, result: unknown, cfg: EchoReportConfig = ECHO_REPORT_CONFIG): AsScreening | null {
  const family = modelFamily(model) ?? model;
  const res = isRecord(result) ? result : {};
  const band = (cfg.asScreening?.vmaxBand?.[family] as number) ?? null;
  if (family === MODEL_PANECHO) {
    const { predictions, diagnoses, screening } = panEchoParts(res);
    const probs = predictions['Aortic valve stenosis'];
    let pSevere: number | null = null;
    let pAny: number | null = null;
    if (Array.isArray(probs) && probs.length === 3) {
      pSevere = Number(probs[2]);
      pAny = Math.min(1.0, Number(probs[0]) + Number(probs[2]));
    }
    const vmax = finite(predictions['Aortic valve peak velocity']);
    const uncorrected = finite(predictions['Aortic valve peak velocity (uncorrected)']);
    const calibrated = calibratedAsLabel(diagnoses, screening, [
      'Significant AS likely, severe possible',
      'Significant AS likely',
    ]);
    if (pSevere === null && vmax === null && calibrated === null) {
      return null;
    }
    const note = screening && isRecord(screening.note) ? (screening.note as Bilingual) : null;
    return { pSevere, pAny, vmax, vmaxUncorrected: uncorrected, vmaxBand: band, calibratedLabel: calibrated, note };
  }
  if (family === MODEL_ECHOALIGN) {
    const heads = echoAlignHeads(res);
    const grade = heads.aortic_stenosis_grade;
    const classifier = heads.aortic_stenosis_classification;
    const vmax = heads.transaortic_peak_velocity;
    let pSevere: number | null = null;
    let pAny: number | null = null;
    if (grade && isRecord(grade.probabilities)) {
      pSevere = finite(grade.probabilities.severe);
      const normal = finite(grade.probabilities.normal);
      pAny = normal === null ? null : Math.max(0.0, Math.min(1.0, 1.0 - normal));
    }
    const out: AsScreening = {
      pSevere,
      pAny,
      grade: grade ? ((grade.grade as string) ?? null) : null,
      vmax: vmax ? finite(vmax.value) : null,
      vmaxUncorrected: null,
      vmaxBand: band,
      calibratedLabel: null,
    };
    if (classifier) {
      out.pModerateOrSevere = finite(classifier.probability);
      out.moderateOrSevereCalled = classifier.called === true;
      out.threshold = finite(classifier.threshold);
    }
    if (out.pSevere === null && out.pAny === null && out.vmax === null) {
      return null;
    }
    return out;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

function aiText(finding: AiFinding, cfg: EchoReportConfig, lang: Lang): string {
  const strings = cfg.strings;
  const label = (finding.text as Bilingual)[lang];
  const ai = strings.aiEstimate[lang];
  if (finding.kind === 'regression') {
    let value = formatValue(finding.value as number, finding.unit, finding.digits ?? 1, lang);
    const band = finding.band;
    if (band !== null && band !== undefined) {
      value += ` ± ${formatNumber(band, band < 10 ? 1 : 0, lang)}`;
    }
    return `${label} (${ai}: ${value})`;
  }
  const pct = formatPercent(finding.probability);
  if (finding.calibrated) {
    const parts = [ai];
    if (pct) {
      parts.push((lang === 'en' ? 'P(any AS) ' : 'P(toute SA) ') + pct);
    }
    parts.push(lang === 'en' ? 'MHI-calibrated' : 'calibré ICM');
    return `${label} (${parts.join(', ')})`;
  }
  const parts = [ai];
  if (pct) parts.push(pct);
  if (finding.threshold !== null && finding.threshold !== undefined) {
    parts.push(`${strings.threshold[lang]} ${formatPercent(finding.threshold)}`);
  }
  return `${label} (${parts.join(', ')})`;
}

export interface ConclusionItem {
  structure: string;
  concept: string;
  source: 'measured' | 'ai';
  text: Bilingual;
  level?: number;
  discordant?: boolean;
  ref?: string | null;
  probability?: number | null;
  structureLabel: Bilingual;
  line: Bilingual;
}

export interface SectionNote {
  structure: string;
  section: string;
  concept: string;
  text: Bilingual;
}

export function buildConclusion(
  measured: MeasuredFinding[],
  ai: AiFinding[],
  cfg: EchoReportConfig = ECHO_REPORT_CONFIG
): { items: ConclusionItem[]; notes: SectionNote[] } {
  const structures: Record<string, Rec> = {};
  const order: Record<string, number> = {};
  (cfg.structures as Rec[]).forEach((s, i) => {
    structures[s.id as string] = s;
    order[s.id as string] = i;
  });
  const byConceptMeasured: Record<string, MeasuredFinding[]> = {};
  for (const f of measured) (byConceptMeasured[f.concept] ??= []).push(f);
  const byConceptAi: Record<string, AiFinding[]> = {};
  for (const f of ai) (byConceptAi[f.concept] ??= []).push(f);
  const strings = cfg.strings;
  const seen: string[] = [];
  for (const f of [...measured, ...ai]) {
    if (!seen.includes(f.concept)) seen.push(f.concept);
  }
  const items: Omit<ConclusionItem, 'structureLabel' | 'line'>[] = [];
  const notes: SectionNote[] = [];
  for (const concept of seen) {
    const m = byConceptMeasured[concept] ?? [];
    const a = byConceptAi[concept] ?? [];
    const aiPositive = a.find(f => f.positive) ?? null;
    const mPositive = m.filter(f => f.positive);
    if (mPositive.length) {
      const top = mPositive.reduce((best, f) => (f.level > best.level ? f : best), mPositive[0]);
      const text = {} as Bilingual;
      for (const lang of ['en', 'fr'] as Lang[]) {
        const values = mPositive.map(f => f.values[lang]).filter(Boolean).join('; ');
        let body = (top.label as Bilingual)[lang];
        if (values) body += ` (${strings.measured[lang]}: ${values})`;
        if (a.length && aiPositive === null) body += ` (${strings.discordantAiNegative[lang]})`;
        text[lang] = body;
      }
      items.push({
        structure: top.structure,
        concept,
        source: 'measured',
        text,
        level: top.level,
        discordant: !!(a.length && aiPositive === null),
        ref: top.ref ?? null,
      });
    } else if (m.length && aiPositive) {
      const text = {} as Bilingual;
      for (const lang of ['en', 'fr'] as Lang[]) {
        const values = m.map(f => f.values[lang]).filter(Boolean).join('; ');
        text[lang] = (strings.discordantMeasuredNormal[lang] as string)
          .replace('{ai}', aiText(aiPositive, cfg, lang))
          .replace('{measured}', values);
      }
      notes.push({
        structure: aiPositive.structure,
        section: structures[aiPositive.structure].section as string,
        concept,
        text,
      });
    } else if (!m.length && aiPositive) {
      items.push({
        structure: aiPositive.structure,
        concept,
        source: 'ai',
        text: { en: aiText(aiPositive, cfg, 'en'), fr: aiText(aiPositive, cfg, 'fr') },
        probability: aiPositive.probability ?? null,
      });
    }
  }
  // Stable sort, like Python's sorted().
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((x, y) => {
      const ox = order[x.item.structure] ?? 99;
      const oy = order[y.item.structure] ?? 99;
      if (ox !== oy) return ox - oy;
      const sx = x.item.source === 'measured' ? 0 : 1;
      const sy = y.item.source === 'measured' ? 0 : 1;
      if (sx !== sy) return sx - sy;
      return x.index - y.index;
    })
    .map(({ item }) => {
      const s = (structures[item.structure] ?? { en: item.structure, fr: item.structure }) as Bilingual;
      return {
        ...item,
        structureLabel: { en: s.en, fr: s.fr },
        line: { en: `${s.en} — ${item.text.en}`, fr: `${s.fr} — ${item.text.fr}` },
      } as ConclusionItem;
    });
  return { items: sorted, notes };
}

export interface MeasuredRow {
  label: string;
  labelFr?: string;
  site?: unknown;
  measurement?: unknown;
  value: number;
  unit: string;
  display: string;
  derived?: boolean;
}

function measuredRows(measured: unknown, cfg: EchoReportConfig): Record<string, MeasuredRow[]> {
  const rows: Record<string, MeasuredRow[]> = {};
  if (!isRecord(measured)) {
    return rows;
  }
  const entries = Array.isArray(measured.measurements) ? measured.measurements : [];
  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const section = routeSrMeasurement(entry, cfg);
    const value = finite(entry.value);
    if (section === null || value === null) continue;
    const unit = unitDisplay(entry.unit);
    (rows[section] ??= []).push({
      label: measurementLabel(entry),
      site: entry.site,
      measurement: entry.measurement,
      value,
      unit,
      display: formatValue(value, unit, digitsFor(unit)),
    });
  }
  const metrics = measuredMetrics(measured, cfg);
  for (const [metric, section] of [
    ['lavi', 'atria'],
    ['lvedvi', 'lv'],
  ] as const) {
    const item = metrics[metric];
    if (item && item.derived) {
      (rows[section] ??= []).push({
        label: `${item.label.en} (computed from the SR volume and BSA)`,
        labelFr: `${item.label.fr} (calculé à partir du volume et de la SC du SR)`,
        value: item.value,
        unit: item.unit,
        derived: true,
        display: formatValue(item.value, item.unit, item.digits),
      });
    }
  }
  return rows;
}

export interface ReportSection {
  id: string;
  title: Bilingual;
  group: string | null;
  measured: MeasuredRow[];
  ai: AiRow[];
  notes: Bilingual[];
  measuredGrade?: {
    en: string | null;
    fr: string | null;
    grade: string | null;
    discordant: boolean;
    basis: unknown;
    avaNote: unknown;
  };
  asScreening?: AsScreening;
}

export interface EchoStructuredReport {
  schema: string;
  thresholdsVersion: string;
  model: string | null;
  sex: 'male' | 'female' | null;
  sexUnknown: boolean;
  hasMeasured: boolean;
  sections: ReportSection[];
  conclusion: ConclusionItem[];
  noAbnormality: boolean;
  noAbnormalityText: Bilingual;
}

/** The structured report for one echo AI result and the study's measured SR values. */
export function buildReport(
  model: string | null,
  result: unknown,
  measured: unknown = null,
  sex: unknown = null,
  cfg: EchoReportConfig = ECHO_REPORT_CONFIG
): EchoStructuredReport {
  const sexNorm = normalizeSex(sex);
  const family = modelFamily(model) ?? (model ?? '');
  const res = isRecord(result) ? result : {};
  const mFindings = measuredFindings(measured, sexNorm, cfg);
  const aFindings = family ? aiFindings(family, res, sexNorm, cfg) : [];
  const { items: conclusion, notes } = buildConclusion(mFindings, aFindings, cfg);
  const mRows = measuredRows(measured, cfg);
  const aRows = family ? aiRows(family, res, cfg) : [];
  const positiveAi = new Set(aFindings.filter(f => f.positive).map(f => f.key));
  const screening = family ? asScreening(family, res, cfg) : null;
  const grading = isRecord(measured) ? measured.asGrading : null;
  const sections: ReportSection[] = [];
  for (const section of cfg.sections as Rec[]) {
    const sid = section.id as string;
    const entry: ReportSection = {
      id: sid,
      title: { en: section.en as string, fr: section.fr as string },
      group: (section.group as string) ?? null,
      measured: mRows[sid] ?? [],
      ai: aRows.filter(row => row.section === sid).map(row => ({ ...row, flagged: positiveAi.has(row.key) })),
      notes: notes.filter(n => n.section === sid).map(n => n.text),
    };
    if (sid === 'av') {
      if (isRecord(grading) && grading.label) {
        entry.measuredGrade = {
          en: (grading.label as string) ?? null,
          fr: ((grading.labelFr as string) || (grading.label as string)) ?? null,
          grade: (grading.grade as string) ?? null,
          discordant: !!grading.discordant,
          basis: grading.basis ?? null,
          avaNote: grading.avaNote ?? null,
        };
      }
      if (screening) {
        entry.asScreening = screening;
      }
    }
    if (entry.measured.length || entry.ai.length || entry.notes.length || entry.measuredGrade || entry.asScreening) {
      sections.push(entry);
    }
  }
  return {
    schema: ECHO_REPORT_SCHEMA,
    thresholdsVersion: cfg.version,
    model: family || null,
    sex: sexNorm,
    sexUnknown: sexNorm === null,
    hasMeasured:
      isRecord(measured) &&
      !!(
        (Array.isArray(measured.measurements) && measured.measurements.length) ||
        (isRecord(measured.summary) && Object.keys(measured.summary).length)
      ),
    sections,
    conclusion,
    noAbnormality: !conclusion.length,
    noAbnormalityText: cfg.strings.noAbnormality,
  };
}

export function conclusionLines(report: EchoStructuredReport, lang: Lang = 'en'): string[] {
  const lines = report.conclusion.map(item => item.line[lang]);
  return lines.length ? lines : [report.noAbnormalityText[lang]];
}

export function languageOf(language: string | null | undefined): Lang {
  return (language ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
