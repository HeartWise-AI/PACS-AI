// A model-agnostic, readable form of a stored result that has no model-specific
// renderer: flat key/value data becomes table rows. Anything nested is left to
// the generic tree view, which stays reachable as the raw data.

export const READABLE_RESULT_MAX_JSON_STRING_LENGTH = 200_000;
export const READABLE_RESULT_MAX_ROWS = 200;
export const READABLE_RESULT_MAX_VALUE_LENGTH = 400;
// Fewer rows than this are not worth splitting into groups.
const MIN_ROWS_TO_GROUP = 6;
const MAX_QUALIFIER_LENGTH = 60;

export type ReadableResultGroupId =
  | 'leftVentricle'
  | 'rightVentricle'
  | 'leftAtrium'
  | 'rightAtrium'
  | 'valves'
  | 'other';

export type ReadableResultFlag = 'abnormal' | 'normal';

export interface ReadableResultRow {
  label: string;
  // The value without its trailing qualifier, alternatives joined by " / ".
  value: string;
  // The trailing parenthesised interpretation, e.g. "Normal" in "63.0 % (Normal)".
  qualifier: string | null;
  flag: ReadableResultFlag | null;
}

export interface ReadableResultGroup {
  // null when the section is not split into groups.
  id: ReadableResultGroupId | null;
  rows: ReadableResultRow[];
}

export interface ReadableResultSection {
  // The result field the rows come from; null for the result's own fields.
  key: string | null;
  groups: ReadableResultGroup[];
}

export interface ReadableResult {
  sections: ReadableResultSection[];
  // Result fields that are not flat and are only visible in the raw data.
  omittedKeys: string[];
}

type Primitive = string | number | boolean | null;

const GROUP_ORDER: readonly ReadableResultGroupId[] = [
  'leftVentricle',
  'rightVentricle',
  'leftAtrium',
  'rightAtrium',
  'valves',
  'other',
];

// Generic cardiac wording found in the label itself; no model schema involved.
const GROUP_PATTERNS: ReadonlyArray<[ReadableResultGroupId, RegExp]> = [
  ['valves', /\b(valve|valves|valvular)\b/i],
  ['leftVentricle', /\bLV\b|\bleft ventric/i],
  ['rightVentricle', /\bRV\b|\bright ventric/i],
  ['leftAtrium', /\bLA\b|\bleft atri/i],
  ['rightAtrium', /\bRA\b|\bright atri/i],
];

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
 * Parses a string that holds a serialised JSON object or array. Returns
 * undefined for anything else, including oversized or malformed text.
 */
export function parseEmbeddedJSON(value: string): unknown[] | Record<string, unknown> | undefined {
  if (value.length > READABLE_RESULT_MAX_JSON_STRING_LENGTH) {
    return undefined;
  }
  const trimmed = value.trim();
  const closing = trimmed.startsWith('{') ? '}' : trimmed.startsWith('[') ? ']' : null;
  if (!closing || !trimmed.endsWith(closing)) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) || isRecord(parsed) ? parsed : undefined;
  } catch (error: unknown) {
    return undefined;
  }
}

export function classifyReadableResultLabel(label: string): ReadableResultGroupId {
  const match = GROUP_PATTERNS.find(([, pattern]) => pattern.test(label));
  return match ? match[0] : 'other';
}

function flagOf(text: string): ReadableResultFlag | null {
  if (/\babnormal\b/i.test(text)) {
    return 'abnormal';
  }
  return /^normal$/i.test(text.trim()) ? 'normal' : null;
}

function formatAlternatives(text: string): string {
  return text
    .split('|')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part =>
      // A bare enum value such as "none_trace"; free text keeps its underscores.
      /^[A-Za-z0-9]+(_[A-Za-z0-9]+)+$/.test(part) ? part.replace(/_/g, ' ') : part
    )
    .join(' / ');
}

export function formatReadableResultRow(label: string, raw: Primitive): ReadableResultRow {
  if (raw === null) {
    return { label, value: '—', qualifier: null, flag: null };
  }
  if (typeof raw !== 'string') {
    return { label, value: String(raw), qualifier: null, flag: null };
  }

  const text = raw.trim();
  const qualified = text.match(/^(.*\S)\s*\(([^()]*[A-Za-z][^()]*)\)$/);
  const qualifier =
    qualified && qualified[2].trim().length <= MAX_QUALIFIER_LENGTH ? qualified[2].trim() : null;
  const body = qualifier && qualified ? qualified[1] : text;
  const value = formatAlternatives(body) || (text ? body : '—');

  return {
    label,
    value,
    qualifier,
    flag: qualifier ? flagOf(qualifier) : flagOf(value),
  };
}

// Rows of one flat object, or null when the object is not flat enough to tabulate.
function flatRows(record: Record<string, unknown>): ReadableResultRow[] | null {
  const entries = Object.entries(record);
  if (entries.length > READABLE_RESULT_MAX_ROWS) {
    return null;
  }

  const rows: ReadableResultRow[] = [];
  for (const [label, value] of entries) {
    if (
      !isPrimitive(value) ||
      (typeof value === 'string' && value.length > READABLE_RESULT_MAX_VALUE_LENGTH)
    ) {
      return null;
    }
    rows.push(formatReadableResultRow(label, value));
  }
  return rows;
}

function groupRows(rows: ReadableResultRow[]): ReadableResultGroup[] {
  const byGroup = new Map<ReadableResultGroupId, ReadableResultRow[]>();
  rows.forEach(row => {
    const id = classifyReadableResultLabel(row.label);
    byGroup.set(id, [...(byGroup.get(id) ?? []), row]);
  });
  const namedGroups = [...byGroup.keys()].filter(id => id !== 'other').length;
  if (rows.length < MIN_ROWS_TO_GROUP || namedGroups < 2) {
    return [{ id: null, rows }];
  }

  // Rows keep their original order inside each group.
  return GROUP_ORDER.filter(id => byGroup.has(id)).map(id => ({
    id,
    rows: byGroup.get(id) as ReadableResultRow[],
  }));
}

/**
 * Builds the readable form of a result, or null when the generic view should be
 * used instead. String fields that hold serialised JSON are parsed one level.
 */
export function buildReadableResult(value: unknown): ReadableResult | null {
  const root = typeof value === 'string' ? parseEmbeddedJSON(value) : value;
  if (!isRecord(root)) {
    return null;
  }

  const ownRows: ReadableResultRow[] = [];
  const sections: ReadableResultSection[] = [];
  const omittedKeys: string[] = [];

  for (const [key, rawField] of Object.entries(root)) {
    const field =
      typeof rawField === 'string' ? (parseEmbeddedJSON(rawField) ?? rawField) : rawField;

    if (isPrimitive(field)) {
      if (typeof field === 'string' && field.length > READABLE_RESULT_MAX_VALUE_LENGTH) {
        omittedKeys.push(key);
      } else {
        ownRows.push(formatReadableResultRow(key, field));
      }
      continue;
    }

    const rows = isRecord(field) ? flatRows(field) : null;
    if (!rows) {
      omittedKeys.push(key);
    } else if (rows.length > 0) {
      sections.push({ key, groups: groupRows(rows) });
    }
  }

  if (ownRows.length > 0) {
    sections.unshift({ key: null, groups: groupRows(ownRows) });
  }

  const rowCount = sections.reduce(
    (total, section) =>
      total + section.groups.reduce((count, group) => count + group.rows.length, 0),
    0
  );
  if (rowCount === 0 || rowCount > READABLE_RESULT_MAX_ROWS) {
    return null;
  }

  return { sections, omittedKeys };
}
