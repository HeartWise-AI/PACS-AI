import {
  describeResultRun,
  findPendingRunEnd,
  findResultForPendingRun,
  findResultGroup,
  findRunResult,
  formatRunDateTime,
  isSameResultRun,
  listResultRuns,
  mergeResultRuns,
  newestCompletedAt,
  resultFromPendingRun,
} from './viewerResultsModel';
import { createViewerResultsRepository } from './viewerResultsRepository';
import type { PendingViewerModelRun, ViewerModelResult } from './types';

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '2.2.1',
    modality: 'angiogram',
    modelId: 'registration-1',
    artifactModelId: 'DeepCORO_JEPA',
    containerId: 'container-1',
    runId: 'run-auto',
    executionId: 'execution-auto',
    studyServiceJobId: 'job-auto',
    completedAt: '2026-11-26T08:41:20-05:00',
    trigger: 'AUTO',
    selectedViews: null,
    reportAvailable: true,
    ...overrides,
  };
}

// The live case of 2026-11-26: the automatic run used 4 of 5 videos; the user
// then reran the model on one hand-picked series. The automatic run stays the
// reported (best) result and the rerun is only reachable through `runs`.
const autoRun = result({
  dispatchSeriesInstanceUIDs: null,
  eligibleVideoCount: 4,
  inputVideoCount: 5,
  bestRun: true,
});
const viewerRerun = result({
  runId: 'run-viewer',
  executionId: 'execution-viewer',
  studyServiceJobId: 'job-viewer',
  completedAt: '2026-11-26T09:16:15-05:00',
  trigger: 'VIEWER_REQUEST',
  dispatchSeriesInstanceUIDs: ['1.2.3.4'],
  eligibleVideoCount: 1,
  inputVideoCount: 1,
  bestRun: false,
});
const reported = result({
  dispatchSeriesInstanceUIDs: null,
  eligibleVideoCount: 4,
  inputVideoCount: 5,
  runs: [viewerRerun, autoRun],
});

const pending = (overrides: Partial<PendingViewerModelRun> = {}): PendingViewerModelRun => ({
  key: 'container-1',
  studyInstanceUID: '1.2.3',
  modelId: 'DeepCORO_JEPA',
  containerId: 'container-1',
  modelName: 'DeepCORO-JEPA',
  modelVersion: '2.2.1',
  runId: 'run-viewer',
  executionId: 'execution-viewer',
  requestedAt: Date.parse('2026-11-26T09:15:34-05:00'),
  baselineCompletedAt: '2026-11-26T08:41:20-05:00',
  seriesInstanceUIDs: ['1.2.3.4'],
  ...overrides,
});

describe('runs of a model', () => {
  test('lists the runs newest first, or the result alone when none are listed', () => {
    expect(listResultRuns(reported).map(run => run.executionId)).toEqual([
      'execution-viewer',
      'execution-auto',
    ]);
    expect(listResultRuns({ ...reported, runs: [autoRun, viewerRerun] })[0]).toBe(viewerRerun);
    const alone = result();
    expect(listResultRuns(alone)).toEqual([alone]);
    expect(listResultRuns(null)).toEqual([]);
    expect(newestCompletedAt(reported)).toBe(viewerRerun.completedAt);
    expect(newestCompletedAt(null)).toBeNull();
  });

  test('adds the runs the backend does not list to the runs of their model', () => {
    const alone = result();
    const unlisted = result({
      runId: 'run-viewer',
      executionId: 'execution-viewer',
      studyServiceJobId: null,
      completedAt: '2026-11-26T09:16:15-05:00',
      provisional: true,
    });
    const otherModel = { ...unlisted, modelName: 'CathEF-CLIP' };
    const otherStudy = { ...unlisted, studyInstanceUID: '9.9.9' };
    expect(mergeResultRuns(alone, [otherModel, unlisted, otherStudy])).toEqual([unlisted, alone]);
    // A run the backend lists is not repeated.
    expect(mergeResultRuns(reported, [unlisted])).toEqual([viewerRerun, autoRun]);
    expect(mergeResultRuns(alone, [])).toEqual([alone]);
    expect(mergeResultRuns(null, [unlisted])).toEqual([]);
  });

  test('finds the result of a run that is not the reported one', () => {
    expect(findRunResult([reported], { executionId: 'execution-viewer' })).toBe(viewerRerun);
    expect(findRunResult([reported], { runId: 'run-viewer', modelName: 'DeepCORO-JEPA' })).toBe(
      viewerRerun
    );
    expect(findRunResult([reported], { runId: 'run-viewer', modelName: 'Other' })).toBeNull();
    expect(findRunResult([reported], { executionId: 'execution-unknown' })).toBeNull();
    expect(findRunResult([reported], {})).toBeNull();
    // A backend without the run list only knows the reported result.
    const alone = result();
    expect(findRunResult([alone], { executionId: 'execution-auto' })).toBe(alone);
    expect(findRunResult([alone], { executionId: 'execution-viewer' })).toBeNull();
  });

  test('recognizes the same run and the group a run belongs to', () => {
    expect(isSameResultRun(autoRun, reported)).toBe(true);
    expect(isSameResultRun(viewerRerun, reported)).toBe(false);
    expect(isSameResultRun(result({ studyInstanceUID: '9.9.9' }), reported)).toBe(false);
    expect(
      isSameResultRun(
        result({ runId: null, executionId: null, studyServiceJobId: 'job-x' }),
        result({ runId: null, executionId: null, studyServiceJobId: 'job-x' })
      )
    ).toBe(true);
    const other = result({ modelName: 'CathEF-CLIP' });
    expect(findResultGroup(viewerRerun, [other, reported])).toBe(reported);
    expect(findResultGroup(result({ modelName: 'Missing' }), [other, reported])).toBeNull();
  });

  test('finds the result of a pending run although an earlier run stays the reported one', () => {
    expect(findResultForPendingRun(pending(), [reported])).toBe(viewerRerun);
    // Without the run list the reported (automatic) result is not the run's.
    expect(findResultForPendingRun(pending(), [result()])).toBeNull();
    expect(findResultForPendingRun(pending({ studyInstanceUID: '9.9.9' }), [reported])).toBeNull();
  });

  test('recognizes an already active run (no ids) by the run completed after the baseline', () => {
    const unknown = pending({ runId: null, executionId: null });
    expect(findResultForPendingRun(unknown, [reported])).toBe(viewerRerun);
    expect(
      findResultForPendingRun({ ...unknown, baselineCompletedAt: viewerRerun.completedAt }, [
        reported,
      ])
    ).toBeNull();
  });
});

describe('findPendingRunEnd', () => {
  const status = (execution: Record<string, unknown> | null, phase = 'TERMINAL', outcome = '') => ({
    phase,
    outcome: outcome || null,
    executions: execution ? [{ executionId: 'execution-viewer', status: null, ...execution }] : [],
  });

  test('a completed execution ends the wait without looking at the latest results', () => {
    expect(
      findPendingRunEnd(
        status(
          { status: 'completed', completedAt: '2026-11-26T09:16:15-05:00' },
          'TERMINAL',
          'SUCCESS'
        ),
        pending()
      )
    ).toEqual({ kind: 'completed', completedAt: '2026-11-26T09:16:15-05:00' });
    // The execution can complete before the run is aggregated as terminal.
    expect(findPendingRunEnd(status({ status: 'completed' }, 'PROCESSING'), pending())).toEqual({
      kind: 'completed',
      completedAt: null,
    });
  });

  test('reports why a skipped or failed run produced no result', () => {
    expect(
      findPendingRunEnd(
        status(
          {
            status: 'skipped',
            skipReasonCode: 'NO_USABLE_DICOM',
            skipReasonMessage: 'No diagnostic left/right coronary contrast videos were identified',
          },
          'TERMINAL',
          'NO_RESULT'
        ),
        pending()
      )
    ).toEqual({
      kind: 'skipped',
      reason: 'No diagnostic left/right coronary contrast videos were identified',
    });
    expect(
      findPendingRunEnd(status({ status: 'skipped', skipReasonCode: 'NO_USABLE_DICOM' }), pending())
    ).toEqual({ kind: 'skipped', reason: 'NO_USABLE_DICOM' });
    expect(
      findPendingRunEnd(status({ status: 'failed', errorMessage: ' boom ' }), pending())
    ).toEqual({ kind: 'failed', reason: 'boom' });
    const long = findPendingRunEnd(
      status({ status: 'failed', errorMessage: 'x'.repeat(900) }),
      pending()
    );
    expect(long?.kind === 'failed' && long.reason?.length).toBe(240);
    expect(findPendingRunEnd(status({ status: 'cancelled' }), pending())).toEqual({
      kind: 'cancelled',
      reason: null,
    });
  });

  test('keeps waiting only while the run is not finished', () => {
    expect(findPendingRunEnd(status({ status: 'queued' }, 'QUEUED'), pending())).toBeNull();
    expect(findPendingRunEnd(status({ status: 'running' }, 'PROCESSING'), pending())).toBeNull();
    expect(findPendingRunEnd(status(null, 'PROCESSING'), pending())).toBeNull();
  });

  test('uses the outcome of a finished run whose execution is not listed', () => {
    expect(findPendingRunEnd(status(null, 'TERMINAL', 'SUCCESS'), pending())).toEqual({
      kind: 'completed',
      completedAt: null,
    });
    expect(findPendingRunEnd(status(null, 'TERMINAL', 'SUCCESS_WITH_SKIPS'), pending())?.kind).toBe(
      'completed'
    );
    expect(findPendingRunEnd(status(null, 'TERMINAL', 'CANCELLED'), pending())?.kind).toBe(
      'cancelled'
    );
    expect(findPendingRunEnd(status(null, 'TERMINAL', 'NO_RESULT'), pending())?.kind).toBe(
      'failed'
    );
    expect(findPendingRunEnd(status(null, 'TERMINAL', 'FAILED'), pending())?.kind).toBe('failed');
  });
});

describe('resultFromPendingRun', () => {
  test('builds what is needed to open the report of a run the backend does not list', () => {
    expect(resultFromPendingRun(pending(), '2026-11-26T09:16:15-05:00', result())).toEqual({
      studyInstanceUID: '1.2.3',
      modelName: 'DeepCORO-JEPA',
      modelVersion: '2.2.1',
      modality: 'angiogram',
      modelId: 'registration-1',
      artifactModelId: 'DeepCORO_JEPA',
      containerId: 'container-1',
      runId: 'run-viewer',
      executionId: 'execution-viewer',
      studyServiceJobId: null,
      completedAt: '2026-11-26T09:16:15-05:00',
      trigger: 'VIEWER_REQUEST',
      selectedViews: null,
      reportAvailable: true,
      dispatchSeriesInstanceUIDs: ['1.2.3.4'],
      provisional: true,
    });
  });

  test('works without a reported result and needs the run ids', () => {
    const first = resultFromPendingRun(pending({ seriesInstanceUIDs: null }), null, null);
    expect(first).toMatchObject({
      artifactModelId: 'DeepCORO_JEPA',
      reportAvailable: true,
      dispatchSeriesInstanceUIDs: null,
      provisional: true,
    });
    expect(Number.isNaN(Date.parse(first?.completedAt ?? ''))).toBe(false);
    expect(resultFromPendingRun(pending({ executionId: null }), null, null)).toBeNull();
    expect(resultFromPendingRun(pending({ runId: null }), null, null)).toBeNull();
  });
});

describe('describeResultRun', () => {
  const runs = [viewerRerun, autoRun];

  test('tells the rerun from the best run', () => {
    expect(describeResultRun(viewerRerun, runs)).toEqual({
      completedTime: Date.parse('2026-11-26T09:16:15-05:00'),
      trigger: 'viewer',
      series: 1,
      eligibleVideoCount: 1,
      inputVideoCount: 1,
      version: null,
      best: false,
    });
    expect(describeResultRun(autoRun, runs)).toMatchObject({
      trigger: 'auto',
      series: 'all',
      eligibleVideoCount: 4,
      inputVideoCount: 5,
      best: true,
    });
  });

  test('shows the version only when the runs differ, and handles unknown fields', () => {
    const older = result({ modelVersion: '2.2.0', trigger: null, completedAt: null });
    expect(describeResultRun(older, [older, autoRun])).toEqual({
      completedTime: null,
      trigger: 'legacy',
      series: null,
      eligibleVideoCount: null,
      inputVideoCount: null,
      version: '2.2.0',
      // Not flagged by the backend: the reported result is the default one.
      best: true,
    });
    expect(describeResultRun(result({ trigger: 'MANUAL_REPROCESS' }), []).trigger).toBe('manual');
    expect(describeResultRun(result({ trigger: 'LEGACY_IMPORT' }), []).trigger).toBe('imported');
    expect(describeResultRun(result({ provisional: true }), []).best).toBe(false);
    expect(describeResultRun(result({ dispatchSeriesInstanceUIDs: [] }), []).series).toBe('all');
  });

  test('formats the completion time with date and time in the local time zone', () => {
    const time = Date.parse('2026-11-26T09:16:15-05:00');
    const expected = new Date(time).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    expect(formatRunDateTime(time)).toBe(expected);
    expect(formatRunDateTime('2026-11-26T09:16:15-05:00')).toBe(expected);
    // Same instant written in UTC: the label does not depend on the offset sent.
    expect(formatRunDateTime('2026-11-26T14:16:15Z')).toBe(expected);
    expect(formatRunDateTime(null)).toBe('');
    expect(formatRunDateTime('not a date')).toBe('');
  });
});

describe('latest results with listed runs', () => {
  test('maps the runs, counts and best flag and tolerates their absence', async () => {
    const row = {
      modelName: 'DeepCORO-JEPA',
      modelVersion: '2.2.1',
      runId: 'run-auto',
      executionId: 'execution-auto',
      studyServiceJobId: 'job-auto',
      completedAt: '2026-11-26T08:41:20-05:00',
      trigger: 'AUTO',
      selectedViews: null,
      reportAvailable: true,
      dispatchSeriesInstanceUIDs: null,
      eligibleVideoCount: 4,
      inputVideoCount: 5,
      runs: [
        {
          modelName: 'DeepCORO-JEPA',
          runId: 'run-viewer',
          executionId: 'execution-viewer',
          studyServiceJobId: 'job-viewer',
          completedAt: '2026-11-26T09:16:15-05:00',
          trigger: 'VIEWER_REQUEST',
          reportAvailable: true,
          dispatchSeriesInstanceUIDs: ['1.2.3.4'],
          eligibleVideoCount: 1,
          inputVideoCount: 1,
          bestRun: false,
          runs: [{ modelName: 'nested runs are ignored' }],
        },
        { modelName: 'DeepCORO-JEPA', executionId: 'execution-auto', bestRun: true },
        { executionId: 'no model name' },
        null,
      ],
    };
    const http = {
      get: jest.fn().mockResolvedValue({
        data: { results: [row, { modelName: 'CathEF-CLIP', eligibleVideoCount: -1, runs: 'x' }] },
      }),
      post: jest.fn(),
    };

    const [jepa, cathef] = await createViewerResultsRepository(http).loadLatestResults('1.2.3');

    expect(jepa.eligibleVideoCount).toBe(4);
    expect(jepa.inputVideoCount).toBe(5);
    expect(jepa.bestRun).toBeUndefined();
    expect(jepa.runs).toHaveLength(2);
    expect(jepa.runs?.[0]).toMatchObject({
      studyInstanceUID: '1.2.3',
      runId: 'run-viewer',
      executionId: 'execution-viewer',
      trigger: 'VIEWER_REQUEST',
      dispatchSeriesInstanceUIDs: ['1.2.3.4'],
      eligibleVideoCount: 1,
      bestRun: false,
    });
    expect(jepa.runs?.[0].runs).toBeUndefined();
    expect(jepa.runs?.[1].bestRun).toBe(true);
    expect(cathef.runs).toBeUndefined();
    expect('eligibleVideoCount' in cathef).toBe(false);
  });
});
