// The gateway streams the export without patient names (it does not store
// them) and without key results (it has no cheap source). Before saving, the
// viewer fills both from what it can look up: names from the local PACS,
// key results from the completed results of the main models. Both lookups are
// bounded so a large export stays reasonable for the PACS and study-service.

export const PATIENT_NAME_COLUMN = 'Patient name';
export const KEY_RESULT_COLUMN = 'Key result';
const STUDY_COLUMN = 'Study Instance UID';
const MODEL_COLUMN = 'Model';
const STATUS_COLUMN = 'Status';
const RUN_COLUMN = 'Run ID';
const EXECUTION_COLUMN = 'Execution ID';

export const MAX_EXPORT_NAME_LOOKUPS = 300;
export const MAX_EXPORT_RESULT_LOOKUPS = 200;
const LOOKUP_CONCURRENCY = 4;

/** RFC 4180 parser for the gateway's CSV (quoted fields, CRLF, leading BOM). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.startsWith('﻿') ? text.slice(1) : text;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Same rule as the gateway: a cell a spreadsheet would run as a formula is quoted as text. */
export function csvSafeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quoteCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function serializeCSV(rows: string[][]): string {
  return '﻿' + rows.map(row => row.map(quoteCell).join(',')).join('\r\n') + '\r\n';
}

async function runBounded<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(LOOKUP_CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

export interface CSVEnrichmentSources {
  patientName(studyInstanceUID: string): Promise<string | null>;
  // Null when the model has no key result or the result cannot be read.
  keyResult(request: {
    runId: string;
    executionId: string;
    modelName: string;
  }): Promise<string | null>;
  // Whether a model has a key result at all (avoids loading other results).
  hasKeyResult(modelName: string): boolean;
}

export interface CSVEnrichmentSummary {
  namesSkipped: number;
  resultsSkipped: number;
}

/**
 * Fills the patient name and key result columns in place. Values that cannot
 * be looked up stay empty; the counts of lookups left out are returned.
 */
export async function enrichPredictionsCSV(
  rows: string[][],
  sources: CSVEnrichmentSources
): Promise<CSVEnrichmentSummary> {
  const [header] = rows;
  if (!header) {
    return { namesSkipped: 0, resultsSkipped: 0 };
  }
  const column = (name: string) => header.indexOf(name);
  const nameIndex = column(PATIENT_NAME_COLUMN);
  const keyIndex = column(KEY_RESULT_COLUMN);
  const studyIndex = column(STUDY_COLUMN);
  const modelIndex = column(MODEL_COLUMN);
  const statusIndex = column(STATUS_COLUMN);
  const runIndex = column(RUN_COLUMN);
  const executionIndex = column(EXECUTION_COLUMN);
  const body = rows.slice(1).filter(row => row.length === header.length);
  const summary: CSVEnrichmentSummary = { namesSkipped: 0, resultsSkipped: 0 };

  if (nameIndex >= 0 && studyIndex >= 0) {
    const studies = [...new Set(body.map(row => row[studyIndex]).filter(Boolean))];
    const looked = studies.slice(0, MAX_EXPORT_NAME_LOOKUPS);
    summary.namesSkipped = studies.length - looked.length;
    const names = new Map<string, string>();
    await runBounded(looked, async uid => {
      const name = await sources.patientName(uid).catch(() => null);
      if (name) {
        names.set(uid, name);
      }
    });
    for (const row of body) {
      const name = names.get(row[studyIndex]);
      if (name) {
        row[nameIndex] = csvSafeCell(name);
      }
    }
  }

  if (
    keyIndex >= 0 &&
    modelIndex >= 0 &&
    statusIndex >= 0 &&
    runIndex >= 0 &&
    executionIndex >= 0
  ) {
    const wanted = body.filter(
      row => row[statusIndex] === 'completed' && sources.hasKeyResult(row[modelIndex])
    );
    const looked = wanted.slice(0, MAX_EXPORT_RESULT_LOOKUPS);
    summary.resultsSkipped = wanted.length - looked.length;
    await runBounded(looked, async row => {
      const value = await sources
        .keyResult({
          runId: row[runIndex],
          executionId: row[executionIndex],
          modelName: row[modelIndex],
        })
        .catch(() => null);
      if (value) {
        row[keyIndex] = csvSafeCell(value);
      }
    });
  }
  return summary;
}
