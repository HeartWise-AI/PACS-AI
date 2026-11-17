// One-line key result of a completed model run, computed from the result
// payload the viewer already loads for the result drawer. The gateway does not
// store a summary; the rules follow the chat agent's findings digest
// (cardio-agent `findings_digest.py`): the model's own calls and flags are
// reported, never re-thresholded. Only the main models are summarised;
// anything else (or an unexpected payload) has no key result.

import { parseEmbeddedJSON } from '@ohif/app/src/components/inference/studyProcessing/readableResult';

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export type KeyResultModel =
  | 'jepa'
  | 'syntax'
  | 'cto'
  | 'mace'
  | 'cathef-clip'
  | 'deeprv-clip'
  | 'panecho';

const MODEL_KEYS: Record<string, KeyResultModel> = {
  deepcorojepa: 'jepa',
  deepcorosyntax: 'syntax',
  deepcorocto: 'cto',
  deepcoromace: 'mace',
  cathefclip: 'cathef-clip',
  deeprvclip: 'deeprv-clip',
  panecho: 'panecho',
};

export function keyResultModel(modelName: string): KeyResultModel | null {
  return MODEL_KEYS[modelName.toLowerCase().replace(/[^a-z0-9]/g, '')] ?? null;
}

// Segment names as the JEPA projection publishes them (study_results.py).
const JEPA_SEGMENTS: Record<string, string> = {
  left_main: 'Left main',
  prox_lad: 'Proximal LAD',
  mid_lad: 'Mid LAD',
  dist_lad: 'Distal LAD',
  D1: 'First diagonal',
  D2: 'Second diagonal',
  prox_lcx: 'Proximal LCx',
  mid_lcx: 'Mid LCx',
  dist_lcx: 'Distal LCx',
  om1: 'First obtuse marginal',
  om2: 'Second obtuse marginal',
  bx: 'Ramus',
  prox_rca: 'Proximal RCA',
  mid_rca: 'Mid RCA',
  dist_rca: 'Distal RCA',
  pda: 'PDA',
  posterolateral: 'Posterolateral',
  lvp: 'Posterior left ventricular',
};
const LOW_CATEGORIES = new Set(['normal', 'mild', 'moderate']);
const MAX_LISTED = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value: number, places: number): string {
  const factor = 10 ** places;
  return String(Math.round(value * factor) / factor);
}

function predictions(result: Record<string, unknown>): Record<string, unknown> {
  return isRecord(result.predictions) ? result.predictions : {};
}

function listed(items: string[], t: Translate): string {
  const shown = items.slice(0, MAX_LISTED).join(', ');
  return items.length > MAX_LISTED
    ? t('{{items}} and {{count}} more', { items: shown, count: items.length - MAX_LISTED })
    : shown;
}

function summarizeJepa(result: Record<string, unknown>, t: Translate): string | null {
  const segments = predictions(result).segments;
  if (!isRecord(segments)) {
    return null;
  }
  const significant: string[] = [];
  const occluded: string[] = [];
  let assessed = 0;
  for (const [key, name] of Object.entries(JEPA_SEGMENTS)) {
    const data = segments[key];
    if (!isRecord(data) || data.unsupported === true) {
      continue;
    }
    assessed += 1;
    const shown = finite(data.display_pct) ?? finite(data.stenosis_pct);
    const category = typeof data.display_category === 'string' ? data.display_category : null;
    if (data.cto === true) {
      occluded.push(name);
    } else if (
      (data.significant === true && (category === null || !LOW_CATEGORIES.has(category))) ||
      category === 'severe'
    ) {
      significant.push(shown === null ? name : `${name} ${round(shown, 0)}%`);
    }
  }
  if (!assessed) {
    return null;
  }
  const parts: string[] = [];
  if (significant.length) {
    parts.push(t('Significant stenosis {{segments}}', { segments: listed(significant, t) }));
  }
  if (occluded.length) {
    parts.push(t('Occlusion {{segments}}', { segments: listed(occluded, t) }));
  }
  return parts.length ? parts.join(' · ') : t('No significant stenosis');
}

function summarizeSyntax(result: Record<string, unknown>, t: Translate): string | null {
  const values = predictions(result);
  // DeepCORO-SYNTAX v6 publishes syntax.value/band; earlier versions the
  // "Global Cardiac Syntax" regression and category.
  const syntax = isRecord(values.syntax) ? values.syntax : null;
  const legacy = isRecord(values['Global Cardiac Syntax']) ? values['Global Cardiac Syntax'] : null;
  const score = finite(syntax?.value) ?? finite(legacy?.regression);
  if (score === null) {
    return null;
  }
  const band =
    typeof syntax?.band === 'string'
      ? syntax.band
      : typeof legacy?.category === 'string'
        ? legacy.category
        : null;
  return band
    ? t('SYNTAX {{score}} ({{band}})', { score: round(score, 1), band })
    : t('SYNTAX {{score}}', { score: round(score, 1) });
}

function summarizeCto(result: Record<string, unknown>, t: Translate): string | null {
  const values = predictions(result);
  const score = isRecord(values.jctoScore) ? values.jctoScore : null;
  const integer = finite(score?.predictedInteger);
  if (integer === null) {
    return null;
  }
  const parts = [t('J-CTO {{score}}', { score: round(integer, 0) })];
  if (typeof score?.difficulty === 'string' && score.difficulty.trim()) {
    parts[0] = t('J-CTO {{score}} ({{difficulty}})', {
      score: round(integer, 0),
      difficulty: score.difficulty.trim(),
    });
  }
  if (typeof values.ctoArtery === 'string' && values.ctoArtery.trim()) {
    parts.push(values.ctoArtery.trim());
  }
  return parts.join(' · ');
}

function summarizeMace(result: Record<string, unknown>, t: Translate): string | null {
  const primary = predictions(result).primary;
  const composite =
    isRecord(primary) && isRecord(primary.compositeMace) ? primary.compositeMace : null;
  const probability = finite(composite?.probability);
  if (probability === null) {
    return null;
  }
  const score = round(probability, 2);
  if (composite?.aboveResearchThreshold === true) {
    return t('MACE research score {{score}} (above threshold)', { score });
  }
  if (composite?.aboveResearchThreshold === false) {
    return t('MACE research score {{score}} (below threshold)', { score });
  }
  return t('MACE research score {{score}}', { score });
}

function summarizeCathEf(result: Record<string, unknown>, t: Translate): string | null {
  const values = predictions(result);
  const lvef = finite(isRecord(values.LVEF) ? values.LVEF.value : null);
  if (lvef === null) {
    return null;
  }
  const call = isRecord(values.reducedEF) ? values.reducedEF.diagnosis : null;
  if (call === 'reduced') {
    return t('LVEF {{value}}% · reduced', { value: round(lvef, 0) });
  }
  if (call === 'preserved') {
    return t('LVEF {{value}}% · preserved', { value: round(lvef, 0) });
  }
  return t('LVEF {{value}}%', { value: round(lvef, 0) });
}

function summarizeDeepRv(result: Record<string, unknown>, t: Translate): string | null {
  const abnormal = predictions(result).abnormalRV;
  if (
    !isRecord(abnormal) ||
    (abnormal.diagnosis !== 'normal' && abnormal.diagnosis !== 'abnormal')
  ) {
    return null;
  }
  const probability = finite(abnormal.probability);
  const call =
    abnormal.diagnosis === 'abnormal' ? t('RV function abnormal') : t('RV function normal');
  return probability === null
    ? call
    : t('{{call}} (probability {{probability}})', { call, probability: round(probability, 2) });
}

const PANECHO_LVEF = 'Left ventricular (LV) ejection fraction';

function summarizePanEcho(result: Record<string, unknown>, t: Translate): string | null {
  // PanEcho serialises its readable diagnoses as JSON in the diagnosis string.
  const diagnoses =
    typeof result.diagnosis === 'string' ? parseEmbeddedJSON(result.diagnosis) : undefined;
  const readable = isRecord(diagnoses) ? diagnoses[PANECHO_LVEF] : undefined;
  if (typeof readable === 'string' && readable.trim()) {
    return t('LVEF {{value}}', { value: readable.trim() });
  }
  const value = finite(predictions(result)[PANECHO_LVEF]);
  return value === null ? null : t('LVEF {{value}}%', { value: round(value, 0) });
}

const SUMMARIZERS: Record<
  KeyResultModel,
  (result: Record<string, unknown>, t: Translate) => string | null
> = {
  jepa: summarizeJepa,
  syntax: summarizeSyntax,
  cto: summarizeCto,
  mace: summarizeMace,
  'cathef-clip': summarizeCathEf,
  'deeprv-clip': summarizeDeepRv,
  panecho: summarizePanEcho,
};

/** The key result, or null when the model is not summarised or the payload is unexpected. */
export function summarizeKeyResult(
  modelName: string,
  result: unknown,
  t: Translate
): string | null {
  const model = keyResultModel(modelName);
  if (!model || !isRecord(result)) {
    return null;
  }
  try {
    const summary = SUMMARIZERS[model](result, t);
    return summary && summary.trim() ? summary.trim() : null;
  } catch (error: unknown) {
    return null;
  }
}
