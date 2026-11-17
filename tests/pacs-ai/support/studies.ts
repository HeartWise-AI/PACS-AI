import type { Page } from '@playwright/test';
import { apiCall, onAppOrigin } from './api';
import type { ReferenceStudy } from './env';

/**
 * Study images are removed from the server's local Orthanc about 24 h after
 * they arrive; only AI results stay. Before a spec opens a reference study in
 * the viewer it makes sure the study is local again, with the same api-pacs
 * calls as the viewer's "Refresh study from PACS" button
 * (components/inference/studyRefresh/studyRefreshRepository.ts):
 *   GET  /v1/orthanc/modalities/list
 *   POST /v1/orthanc/modality/retrieve { modalityId, studyInstanceUID }
 *   GET  /v1/orthanc/jobs?jobIds=…
 * Presence is read from the local DICOMweb through the app's proxy
 * (<api>/proxy/orthanc/dicom-web, the viewer's data source).
 */

export interface LocalStudyStatus {
  ok: boolean;
  seriesCount: number;
  retrieved: boolean;
  reason?: string;
}

const RETRIEVE_TIMEOUT_MS = 10 * 60_000;
const cache = new Map<string, LocalStudyStatus>();

export async function localSeriesCount(page: Page, uid: string): Promise<number> {
  const res = await apiCall<unknown[]>(
    page,
    'GET',
    `/proxy/orthanc/dicom-web/studies/${encodeURIComponent(uid)}/series?includefield=0020000E`
  );
  if (res.status === 204 || res.status === 404) return 0;
  if (res.status !== 200) throw new Error(`local DICOMweb answered HTTP ${res.status}`);
  return Array.isArray(res.json) ? res.json.length : 0;
}

type Modalities = Record<string, { allowMove?: boolean; targetCMoveEnabled?: boolean } | null>;

async function sourceModality(page: Page): Promise<string | null> {
  const res = await apiCall<{ data?: { modalities?: Modalities } }>(page, 'GET', '/v1/orthanc/modalities/list');
  const modalities = res.json?.data?.modalities ?? {};
  const ids = Object.keys(modalities);
  const fromWorklist = await page.evaluate(() => localStorage.getItem('selectedDICOMModality'));
  if (fromWorklist && ids.includes(fromWorklist.trim())) return fromWorklist.trim();
  const retrievable = ids.filter(
    id => modalities[id]?.allowMove !== false && modalities[id]?.targetCMoveEnabled !== false
  );
  if (retrievable.length === 1) return retrievable[0];
  // The hospital PACS is registered as PACS_QUERY on the reference server.
  if (ids.includes('PACS_QUERY')) return 'PACS_QUERY';
  return null;
}

async function waitForJobs(page: Page, jobIds: string[]): Promise<string | null> {
  const deadline = Date.now() + RETRIEVE_TIMEOUT_MS;
  const query = jobIds.map(id => `jobIds=${encodeURIComponent(id)}`).join('&');
  while (Date.now() < deadline) {
    const res = await apiCall<{ data?: Array<{ progress?: number; state?: string }> }>(
      page,
      'GET',
      `/v1/orthanc/jobs?${query}`
    );
    const jobs = Array.isArray(res.json?.data) ? res.json!.data! : [];
    if (jobs.some(j => j.state === 'Failure')) return 'a retrieve job failed';
    if (jobs.length && jobs.every(j => Number(j.progress) === 100)) return null;
    await page.waitForTimeout(3_000);
  }
  return 'the retrieve did not finish within 10 minutes';
}

/**
 * Makes the study local (retrieving it from the PACS when it is missing or has
 * fewer than `minSeries` series) and reports whether it is usable.
 */
export async function ensureStudyLocal(
  page: Page,
  study: ReferenceStudy,
  minSeries = 1
): Promise<LocalStudyStatus> {
  const cached = cache.get(study.uid);
  if (cached?.ok && cached.seriesCount >= minSeries) return cached;
  await onAppOrigin(page);
  let count = await localSeriesCount(page, study.uid);
  if (count >= minSeries) {
    const status = { ok: true, seriesCount: count, retrieved: false };
    cache.set(study.uid, status);
    return status;
  }
  const modalityId = await sourceModality(page);
  if (!modalityId) {
    return { ok: false, seriesCount: count, retrieved: false, reason: 'no PACS source modality could be determined' };
  }
  const res = await apiCall<{ data?: Array<{ id?: string }>; errorCode?: string }>(
    page,
    'POST',
    '/v1/orthanc/modality/retrieve',
    { modalityId, studyInstanceUID: study.uid }
  );
  if (res.status >= 400 && res.json?.errorCode !== 'DUPLICATE_RECORD') {
    return {
      ok: false,
      seriesCount: count,
      retrieved: false,
      reason: `retrieve from the PACS was refused (HTTP ${res.status} ${res.json?.errorCode ?? ''})`.trim(),
    };
  }
  const jobIds = (res.json?.data ?? []).map(j => j?.id).filter((id): id is string => !!id);
  if (jobIds.length) {
    const failure = await waitForJobs(page, jobIds);
    if (failure) return { ok: false, seriesCount: count, retrieved: true, reason: failure };
  }
  // Orthanc indexes the last instances shortly after the job completes.
  for (let i = 0; i < 20; i++) {
    count = await localSeriesCount(page, study.uid);
    if (count >= minSeries) break;
    await page.waitForTimeout(3_000);
  }
  const status: LocalStudyStatus =
    count >= minSeries
      ? { ok: true, seriesCount: count, retrieved: true }
      : {
          ok: false,
          seriesCount: count,
          retrieved: true,
          reason: `after the retrieve the local store has ${count} series (need ${minSeries})`,
        };
  if (status.ok) cache.set(study.uid, status);
  return status;
}
