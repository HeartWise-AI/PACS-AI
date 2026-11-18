import fs from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { env, ensureDir, referenceStudies, storageStatePath, usStudies, xaStudies, type ReferenceStudy } from './support/env';
import { ensureStudyLocal } from './support/studies';
import { viewerURL } from './support/viewer';

/**
 * Viewer load time (P3.5), opt-in: PACS_AI_E2E_LOAD_TIME=1.
 *
 * For one XA and one US study (default: the first of each in
 * PACS_AI_E2E_STUDY_UIDS; PACS_AI_E2E_LOAD_TIME_STUDIES=<TAG>,<TAG> to choose),
 * opens the viewer PACS_AI_E2E_LOAD_TIME_REPS times (default 3), each time in
 * a new browser context (empty HTTP cache), and measures from navigation
 * start (performance.now() of the viewer document):
 *
 *   firstImageMs       first frame drawn in the viewport: the viewport canvas
 *                      has non-black pixels
 *   allThumbnailsMs    the last change after which every study browser
 *                      thumbnail of the study shows its image (or is a
 *                      no-image thumbnail, e.g. SR/DOC), and stays so for 5 s
 *   firstCineAdvanceMs first change of the shown frame while cine plays
 *   cineFps            frames per second actually shown during 4 s of cine
 *                      after all thumbnails are in (informative)
 *
 * Prints the medians and every run as JSON and writes them to
 * <PACS_AI_E2E_OUTPUT_DIR>/load-time-<build>.json. Only selectors and globals
 * both the 3.11 production build and the 3.13 build have are used
 * (`study-browser-thumbnail[-no-image]` data-cy with id `thumbnail-<display
 * set UID>`, `.cornerstone-viewport-element canvas`, `window.services`), so
 * the same spec compares the two builds. Read-only, apart from retrieving the
 * study from the PACS when it is not local (as the other viewer specs do).
 */

const REPS = Math.max(1, Number(process.env.PACS_AI_E2E_LOAD_TIME_REPS || 3));
const RUN_TIMEOUT_MS = 150_000;
const SETTLE_MS = 5_000;

interface RunResult {
  firstImageMs: number | null;
  allThumbnailsMs: number | null;
  thumbnails: number;
  firstCineAdvanceMs: number | null;
  cineFps: number | null;
}

function chosenStudies(): ReferenceStudy[] {
  const wanted = (process.env.PACS_AI_E2E_LOAD_TIME_STUDIES ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (wanted.length) {
    return wanted.map(tag => referenceStudies().find(s => s.tag === tag)).filter((s): s is ReferenceStudy => !!s);
  }
  return [xaStudies()[0], usStudies()[0]].filter((s): s is ReferenceStudy => !!s);
}

/** Runs in the page from document start; records the milestones on window.__pacsAiLoadTime. */
function monitor(studyUID: string) {
  const w = window as any;
  const state = {
    firstImageMs: null as number | null,
    thumbSignature: '',
    thumbChangedMs: 0,
    thumbsComplete: false,
    thumbnails: 0,
    cineIndex: null as number | null,
    firstCineAdvanceMs: null as number | null,
  };
  w.__pacsAiLoadTime = state;
  const probe = document.createElement('canvas');
  probe.width = 32;
  probe.height = 32;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });

  const imageDrawn = (): boolean => {
    const canvas = document.querySelector(
      '.cornerstone-viewport-element canvas.cornerstone-canvas, .cornerstone-viewport-element canvas'
    ) as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height || !probeCtx) return false;
    try {
      probeCtx.clearRect(0, 0, 32, 32);
      probeCtx.drawImage(canvas, 0, 0, 32, 32);
      const data = probeCtx.getImageData(0, 0, 32, 32).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] + data[i + 1] + data[i + 2] > 30) lit++;
      }
      return lit >= 10;
    } catch {
      return false;
    }
  };

  const thumbnailsOfStudy = () => {
    const services = w.services;
    const nodes = Array.from(
      document.querySelectorAll('[data-cy="study-browser-thumbnail"], [data-cy="study-browser-thumbnail-no-image"]')
    ) as HTMLElement[];
    return nodes.filter(node => {
      const uid = (node.id || '').replace(/^thumbnail-/, '');
      const ds = services?.displaySetService?.getDisplaySetByUID?.(uid);
      return !ds || ds.StudyInstanceUID === studyUID;
    });
  };

  const tick = () => {
    const now = performance.now();
    if (state.firstImageMs === null && imageDrawn()) state.firstImageMs = now;

    const thumbs = thumbnailsOfStudy();
    const loaded = thumbs.filter(node => {
      if (node.getAttribute('data-cy') === 'study-browser-thumbnail-no-image') return true;
      const img = node.querySelector('img') as HTMLImageElement | null;
      return !!img && img.complete && img.naturalWidth > 0;
    }).length;
    const signature = `${thumbs.length}/${loaded}`;
    if (signature !== state.thumbSignature) {
      state.thumbSignature = signature;
      state.thumbChangedMs = now;
    }
    state.thumbnails = thumbs.length;
    state.thumbsComplete = thumbs.length > 0 && loaded === thumbs.length;

    if (state.firstImageMs !== null && state.firstCineAdvanceMs === null) {
      try {
        const services = w.services;
        const id = services.viewportGridService.getActiveViewportId();
        const playing = !!services.cineService.getState()?.cines?.[id]?.isPlaying;
        const index = services.cornerstoneViewportService.getCornerstoneViewport(id)?.getCurrentImageIdIndex?.();
        if (typeof index === 'number') {
          if (state.cineIndex === null) state.cineIndex = index;
          else if (index !== state.cineIndex && playing) state.firstCineAdvanceMs = now;
          else if (!playing) state.cineIndex = index;
        }
      } catch {
        // services not ready yet
      }
    }
  };
  setInterval(tick, 20);
}

async function cineFps(page: Page, ms = 4_000): Promise<number | null> {
  return page.evaluate(async ms => {
    const services = (window as any).services;
    const id = services.viewportGridService.getActiveViewportId();
    const viewport = services.cornerstoneViewportService.getCornerstoneViewport(id);
    if (!services.cineService.getState()?.cines?.[id]?.isPlaying) return null;
    let last = viewport.getCurrentImageIdIndex();
    let changes = 0;
    let first = 0;
    let latest = 0;
    const start = performance.now();
    await new Promise<void>(resolve => {
      const timer = setInterval(() => {
        const index = viewport.getCurrentImageIdIndex();
        const now = performance.now();
        if (index !== last) {
          if (!first) first = now;
          else changes++;
          latest = now;
          last = index;
        }
        if (now - start > ms) {
          clearInterval(timer);
          resolve();
        }
      }, 4);
    });
    return changes && latest > first ? Math.round(((changes * 1000) / (latest - first)) * 10) / 10 : null;
  }, ms);
}

async function measureOnce(browser: Browser, study: ReferenceStudy): Promise<RunResult> {
  const context = await browser.newContext({
    baseURL: env.baseURL,
    storageState: storageStatePath,
    ignoreHTTPSErrors: true,
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  try {
    await context.addInitScript(monitor, study.uid);
    const page = await context.newPage();
    await page.goto(viewerURL(study.uid));
    const read = () => page.evaluate(() => ({ ...(window as any).__pacsAiLoadTime, now: performance.now() }));
    const deadline = Date.now() + RUN_TIMEOUT_MS;
    let s = await read();
    while (Date.now() < deadline) {
      s = await read();
      const thumbsSettled = s.thumbsComplete && s.now - s.thumbChangedMs >= SETTLE_MS;
      if (s.firstImageMs !== null && s.firstCineAdvanceMs !== null && thumbsSettled) break;
      await page.waitForTimeout(250);
    }
    const fps = s.firstImageMs !== null ? await cineFps(page).catch(() => null) : null;
    return {
      firstImageMs: s.firstImageMs === null ? null : Math.round(s.firstImageMs),
      allThumbnailsMs: s.thumbsComplete ? Math.round(s.thumbChangedMs) : null,
      thumbnails: s.thumbnails,
      firstCineAdvanceMs: s.firstCineAdvanceMs === null ? null : Math.round(s.firstCineAdvanceMs),
      cineFps: fps,
    };
  } finally {
    await context.close();
  }
}

function median(values: Array<number | null>): number | null {
  const v = values.filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round(((v[mid - 1] + v[mid]) / 2) * 10) / 10;
}

const results: Record<string, unknown> = {};
let build = 'unknown';

test.describe('viewer load time', () => {
  test.skip(process.env.PACS_AI_E2E_LOAD_TIME !== '1', 'opt-in: set PACS_AI_E2E_LOAD_TIME=1');

  test.afterAll(() => {
    if (!Object.keys(results).length) return;
    const report = { build, repetitions: REPS, measuredAt: new Date().toISOString(), studies: results };
    const json = JSON.stringify(report, null, 2);
    console.log(`[load-time] ${json}`);
    ensureDir(env.outputDir);
    fs.writeFileSync(path.join(env.outputDir, `load-time-${build.replace(/[^\w.-]/g, '_')}.json`), json + '\n');
  });

  const studies = chosenStudies();
  test('a study to measure is configured', () => {
    expect(studies.length, 'XA/US tags in PACS_AI_E2E_STUDY_UIDS or PACS_AI_E2E_LOAD_TIME_STUDIES').toBeGreaterThan(0);
  });

  for (const study of studies) {
    test(`${study.tag}: first image, thumbnails, cine`, async ({ page, browser }) => {
      test.setTimeout((REPS + 1) * (RUN_TIMEOUT_MS + 30_000) + 10 * 60_000);
      const local = await ensureStudyLocal(page, study);
      test.skip(!local.ok, `${study.tag} is not available locally: ${local.reason}`);
      build = await page
        .evaluate(async () => (await (await fetch('/version.json', { cache: 'no-store' })).json())?.buildId)
        .catch(() => 'unknown');

      // One unmeasured open so that the server-side caches are in the same
      // state for every measured run (and for both builds).
      await measureOnce(browser, study);
      const runs: RunResult[] = [];
      for (let i = 0; i < REPS; i++) runs.push(await measureOnce(browser, study));
      results[study.tag] = {
        median: {
          firstImageMs: median(runs.map(r => r.firstImageMs)),
          allThumbnailsMs: median(runs.map(r => r.allThumbnailsMs)),
          firstCineAdvanceMs: median(runs.map(r => r.firstCineAdvanceMs)),
          cineFps: median(runs.map(r => r.cineFps)),
          thumbnails: median(runs.map(r => r.thumbnails)),
        },
        runs,
      };
      console.log(`[load-time] ${study.tag}: ${JSON.stringify(results[study.tag])}`);
      expect(runs.every(r => r.firstImageMs !== null), 'every run drew an image').toBe(true);
    });
  }
});
