// "Compare with latest": a two-column diff when both results are flat
// key -> value objects, otherwise the two raw JSON documents side by side.

import { parseEmbeddedJSON } from '@ohif/app/src/components/inference/studyProcessing/readableResult';

type Primitive = string | number | boolean | null;

export interface ResultDiffRow {
  key: string;
  latest: string;
  earlier: string;
  changed: boolean;
}

export type ResultComparison =
  | { kind: 'flat'; rows: ResultDiffRow[]; changedCount: number }
  | { kind: 'raw'; latest: string; earlier: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/**
 * The flat key -> value form of a result, or null. A result whose only
 * structured content is a JSON object serialised in a string field (PanEcho's
 * `diagnosis`) is read through that field.
 */
export function flatResult(value: unknown): Record<string, Primitive> | null {
  if (!isRecord(value)) {
    return null;
  }
  const entries = Object.entries(value);
  if (entries.length && entries.every(([, item]) => isPrimitive(item))) {
    return value as Record<string, Primitive>;
  }
  if (typeof value.diagnosis === 'string') {
    const embedded = parseEmbeddedJSON(value.diagnosis);
    if (isRecord(embedded)) {
      return flatResult(embedded);
    }
  }
  return null;
}

function display(value: Primitive | undefined): string {
  if (value === undefined) {
    return '—';
  }
  if (value === null) {
    return 'null';
  }
  return String(value);
}

function prettyJSON(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch (error: unknown) {
    return String(value);
  }
}

export function compareResults(latest: unknown, earlier: unknown): ResultComparison {
  const latestFlat = flatResult(latest);
  const earlierFlat = flatResult(earlier);
  if (!latestFlat || !earlierFlat) {
    return { kind: 'raw', latest: prettyJSON(latest), earlier: prettyJSON(earlier) };
  }
  const keys = [...Object.keys(latestFlat)];
  for (const key of Object.keys(earlierFlat)) {
    if (!(key in latestFlat)) {
      keys.push(key);
    }
  }
  const rows = keys.map(key => {
    const latestValue = key in latestFlat ? latestFlat[key] : undefined;
    const earlierValue = key in earlierFlat ? earlierFlat[key] : undefined;
    return {
      key,
      latest: display(latestValue),
      earlier: display(earlierValue),
      changed: latestValue !== earlierValue,
    };
  });
  return { kind: 'flat', rows, changedCount: rows.filter(row => row.changed).length };
}
