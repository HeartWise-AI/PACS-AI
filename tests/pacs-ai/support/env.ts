import fs from 'node:fs';
import path from 'node:path';

/**
 * Every value of the PACS-AI acceptance suite comes from the environment
 * (PLAN.md section 8, rule R3). Nothing here may hold a hostname, credential,
 * patient name, MRN or study UID.
 *
 * Required:
 *   PACS_AI_E2E_BASE_URL      deployed frontend, e.g. https://<server>
 *   PACS_AI_E2E_USER          login e-mail of the test account
 *   PACS_AI_E2E_PASSWORD      its password
 *   PACS_AI_E2E_TENANT        tenant id used in /login?t=<tenant>
 *   PACS_AI_E2E_STUDY_UIDS    comma-separated reference studies, either bare
 *                             UIDs or TAG=UID pairs (TAG names the golden files,
 *                             e.g. XA_<accession suffix>; XA_* angiography, US_* echo)
 *
 * Optional (host folders, never inside the repository):
 *   PACS_AI_E2E_GOLDEN_DIR    AI reference outputs (golden/), run-model.spec
 *   PACS_AI_E2E_AI_RUNS_DIR   request logs of the reference runs (default: ../ai-runs of the golden dir)
 *   PACS_AI_E2E_BASELINE_DIR  baseline screenshots, visual.spec
 *   PACS_AI_E2E_STATE_DIR     storage state and failed-login ledger (default tests/pacs-ai/.state)
 *   PACS_AI_E2E_OUTPUT_DIR    Playwright output (default tests/pacs-ai/.output, git-ignored)
 *
 * Optional switches, see each spec:
 *   PACS_AI_E2E_RUN_STUDIES   tags run-model.spec runs on (default: every XA tag with golden files)
 *   PACS_AI_E2E_RUN_MODELS    comma-separated model names (default: all)
 *   PACS_AI_E2E_GROUP_PAUSE_S pause after every three GPU runs (default 660)
 *   PACS_AI_E2E_WORKLIST_FROM / _TO  work list date range, YYYY-MM-DD (default 2026-11-13..2026-11-15)
 *   PACS_AI_E2E_ALLOW_USER_PREFS=1   allow tests that change the test user's own preferences (restored after)
 *   PACS_AI_E2E_ALLOW_EXTRA_RUNS=1   allow the run-and-cancel check of jobs-and-notifications.spec
 *   PACS_AI_E2E_REGULAR_USER / _PASSWORD  a non-admin account for audience checks
 *   PACS_AI_E2E_LOAD_TIME=1          run load-time.spec (viewer load time, printed as JSON)
 *   PACS_AI_E2E_LOAD_TIME_STUDIES    tags it measures (default: the first XA and the first US tag)
 *   PACS_AI_E2E_LOAD_TIME_REPS       measured opens per study (default 3; median reported)
 */

export const SUITE_ROOT = path.resolve(__dirname, '..');

const read = (name: string): string => (process.env[name] ?? '').trim();

export const env = {
  baseURL: read('PACS_AI_E2E_BASE_URL').replace(/\/+$/, ''),
  user: read('PACS_AI_E2E_USER'),
  password: process.env.PACS_AI_E2E_PASSWORD ?? '',
  tenant: read('PACS_AI_E2E_TENANT'),
  studyUIDs: read('PACS_AI_E2E_STUDY_UIDS'),
  goldenDir: read('PACS_AI_E2E_GOLDEN_DIR'),
  aiRunsDir: read('PACS_AI_E2E_AI_RUNS_DIR'),
  baselineDir: read('PACS_AI_E2E_BASELINE_DIR'),
  stateDir: read('PACS_AI_E2E_STATE_DIR') || path.join(SUITE_ROOT, '.state'),
  outputDir: read('PACS_AI_E2E_OUTPUT_DIR') || path.join(SUITE_ROOT, '.output'),
  runStudies: read('PACS_AI_E2E_RUN_STUDIES'),
  runModels: read('PACS_AI_E2E_RUN_MODELS'),
  groupPauseSeconds: Number(read('PACS_AI_E2E_GROUP_PAUSE_S') || 660),
  worklistFrom: read('PACS_AI_E2E_WORKLIST_FROM') || '2026-11-13',
  worklistTo: read('PACS_AI_E2E_WORKLIST_TO') || '2026-11-15',
  allowUserPrefs: read('PACS_AI_E2E_ALLOW_USER_PREFS') === '1',
  allowExtraRuns: read('PACS_AI_E2E_ALLOW_EXTRA_RUNS') === '1',
  regularUser: read('PACS_AI_E2E_REGULAR_USER'),
  regularPassword: process.env.PACS_AI_E2E_REGULAR_PASSWORD ?? '',
};

export const storageStatePath = path.join(env.stateDir, 'storage-state.json');

export function missingRequiredEnv(): string[] {
  const missing: string[] = [];
  if (!env.baseURL) missing.push('PACS_AI_E2E_BASE_URL');
  if (!env.user) missing.push('PACS_AI_E2E_USER');
  if (!env.password) missing.push('PACS_AI_E2E_PASSWORD');
  if (!env.tenant) missing.push('PACS_AI_E2E_TENANT');
  if (!env.studyUIDs) missing.push('PACS_AI_E2E_STUDY_UIDS');
  return missing;
}

export interface ReferenceStudy {
  /** Name of the study in golden/baseline files, e.g. XA_<accession suffix>; never a UID. */
  tag: string;
  uid: string;
  /** Modality guessed from the tag prefix; null when the tag does not say. */
  modality: 'XA' | 'US' | null;
}

export function referenceStudies(): ReferenceStudy[] {
  return env.studyUIDs
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const eq = entry.indexOf('=');
      const tag = eq > 0 ? entry.slice(0, eq).trim() : `STUDY_${index + 1}`;
      const uid = eq > 0 ? entry.slice(eq + 1).trim() : entry;
      const prefix = tag.split('_')[0].toUpperCase();
      const modality = prefix === 'XA' || prefix === 'US' ? prefix : null;
      return { tag, uid, modality };
    });
}

export const xaStudies = () => referenceStudies().filter(s => s.modality === 'XA');
export const usStudies = () => referenceStudies().filter(s => s.modality === 'US');

export function aiRunsDir(): string {
  if (env.aiRunsDir) return env.aiRunsDir;
  return env.goldenDir ? path.join(path.dirname(path.resolve(env.goldenDir)), 'ai-runs') : '';
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** MM/DD/YYYY as the work list's date range picker expects. */
export function pickerDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}
