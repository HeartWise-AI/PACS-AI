import fs from 'node:fs';
import path from 'node:path';
import { aiRunsDir, env } from './env';

/**
 * AI reference outputs kept on the host (PACS_AI_E2E_GOLDEN_DIR), never in
 * the repository. Layout (PLAN.md section 8):
 *   golden/<study>__<model key>.txt   rendered result text
 *   golden/index.json                 [{ study, model, header, source }]
 *   ai-runs/<study>__<model key>.net.json  request sent by the reference run
 *   ai-runs/summary.json              [{ study, model, kind, selection, state }]
 * <model key> is the menu label with every run of non-word characters
 * replaced by "_", e.g. "DeepRV-CLIP (1.0.1-HTML)" -> "DeepRV-CLIP_1.0.1-HTML_".
 */

export const modelKey = (label: string) => label.replace(/[^\w.-]+/g, '_');

export interface GoldenRun {
  study: string;
  model: string;
  /** report-frame: the HTML report's text; result-data: the drawer's text. */
  source: 'report-frame' | 'result-data';
  text: string;
  /** "N of M series" of the reference run, if recorded. */
  usedOf: { used: number; of: number } | null;
  /** seriesInstanceUIDs of the reference request, in order. */
  seriesInstanceUIDs: string[] | null;
  /** "N selected · Maximum: X · M available" of the reference run. */
  selection: { selected: number; maximum: number; available: number } | null;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

interface IndexEntry {
  study: string;
  model: string;
  header?: string;
  source?: string;
  error?: string;
}

interface SummaryEntry {
  study: string;
  model: string;
  selection?: string;
  state?: string;
}

export function goldenRuns(): GoldenRun[] {
  if (!env.goldenDir || !fs.existsSync(env.goldenDir)) return [];
  const index = readJson<IndexEntry[]>(path.join(env.goldenDir, 'index.json')) ?? [];
  const runsDir = aiRunsDir();
  const summary = (runsDir && readJson<SummaryEntry[]>(path.join(runsDir, 'summary.json'))) || [];
  const out: GoldenRun[] = [];
  for (const entry of index) {
    if (entry.error) continue;
    const key = `${entry.study}__${modelKey(entry.model)}`;
    const textFile = path.join(env.goldenDir, `${key}.txt`);
    if (!fs.existsSync(textFile)) continue;
    const used = entry.header?.match(/(\d+) of (\d+) series/);
    const net = runsDir ? readJson<Array<{ dir: string; body?: string }>>(path.join(runsDir, `${key}.net.json`)) : null;
    let seriesInstanceUIDs: string[] | null = null;
    const request = net?.find(n => n.dir === 'req' && n.body?.includes('seriesInstanceUIDs'));
    if (request?.body) {
      try {
        seriesInstanceUIDs = JSON.parse(request.body).seriesInstanceUIDs ?? null;
      } catch {
        seriesInstanceUIDs = null;
      }
    }
    // Prefer the last finished run of that study and model.
    const sel = [...summary]
      .reverse()
      .find(s => s.study === entry.study && s.model === entry.model && s.state === 'finished')
      ?.selection?.match(/(\d+) selected · Maximum: (\d+) · (\d+) available/);
    out.push({
      study: entry.study,
      model: entry.model,
      source: entry.source === 'result-data' ? 'result-data' : 'report-frame',
      text: fs.readFileSync(textFile, 'utf8'),
      usedOf: used ? { used: Number(used[1]), of: Number(used[2]) } : null,
      seriesInstanceUIDs,
      selection: sel ? { selected: Number(sel[1]), maximum: Number(sel[2]), available: Number(sel[3]) } : null,
    });
  }
  return out;
}

/**
 * Text comparison rule: equal after removing the run timestamp (the only
 * part that legitimately changes between runs) and normalising line ends and
 * trailing blanks.
 */
export function normaliseResultText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(
      /\b\d{4}-\d{2}-\d{2},? \d{1,2}:\d{2}(:\d{2})?\s*(a\.m\.|p\.m\.|AM|PM)?\s*·\s*/g,
      '<run time> · '
    )
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** First differing line, for a readable failure message (no patient data in golden reports). */
export function firstDifference(expected: string, actual: string): string {
  const a = expected.split('\n');
  const b = actual.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return `line ${i + 1}: expected ${JSON.stringify(a[i] ?? '<end>')} got ${JSON.stringify(b[i] ?? '<end>')}`;
    }
  }
  return 'identical';
}
