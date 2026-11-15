import {
  buildSelectedViewBadges,
  findDisplaySetsForSelectedView,
  findLatestResultForModel,
  findPendingRunFailure,
  isResultForPendingRun,
  resolveResultSeriesScope,
} from './viewerResultsModel';
import type { PendingViewerModelRun, SelectedView, ViewerModelResult } from './types';

function result(overrides: Partial<ViewerModelResult>): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '1.3.0',
    modality: 'angiogram',
    modelId: null,
    artifactModelId: null,
    containerId: null,
    runId: null,
    executionId: null,
    studyServiceJobId: null,
    completedAt: '2026-11-10T10:00:00Z',
    trigger: 'AUTO',
    selectedViews: null,
    reportAvailable: false,
    ...overrides,
  };
}

function view(overrides: Partial<SelectedView>): SelectedView {
  return {
    sopInstanceUID: null,
    seriesInstanceUID: null,
    viewLabel: null,
    order: 0,
    role: null,
    extra: null,
    ...overrides,
  };
}

describe('findLatestResultForModel', () => {
  test('matches by container id, then by the model-info id', () => {
    const byContainer = result({ containerId: 'container-1', runId: 'container' });
    const byArtifact = result({ artifactModelId: 'deepcoro-jepa', runId: 'artifact' });
    const model = {
      modelId: 'deepcoro-jepa',
      containerId: 'container-1',
      modelName: 'DeepCORO-JEPA',
      version: '1.3.0',
    };

    expect(findLatestResultForModel(model, [byArtifact, byContainer])).toBe(byContainer);
    expect(findLatestResultForModel({ ...model, containerId: 'other' }, [byArtifact])).toBe(
      byArtifact
    );
  });

  const byId = result({ modelId: 'model-1', modelVersion: '1.2.0', runId: 'by-id' });
  const byNameAndVersion = result({ runId: 'name-version' });
  const byNameOnly = result({ modelVersion: '0.9.0', runId: 'name-only' });

  test('prefers the registered model id', () => {
    expect(
      findLatestResultForModel(
        { modelId: 'model-1', modelName: 'DeepCORO-JEPA', version: '1.3.0' },
        [byNameAndVersion, byId]
      )
    ).toBe(byId);
  });

  test('falls back to name and version, then to name only', () => {
    const model = { modelId: 'other', modelName: 'DeepCORO-JEPA', version: '1.3.0' };
    expect(findLatestResultForModel(model, [byNameOnly, byNameAndVersion])).toBe(byNameAndVersion);
    expect(findLatestResultForModel({ ...model, version: '2.0.0' }, [byNameOnly])).toBe(byNameOnly);
    expect(findLatestResultForModel({ modelName: 'EchoPrime' }, [byNameOnly])).toBeNull();
  });

  test('ignores the study-service modality string and picks the newest match', () => {
    const older = result({ modality: 'angiogram', completedAt: '2026-11-01T00:00:00Z' });
    const newer = result({ modality: 'XA', completedAt: '2026-11-12T00:00:00Z' });
    expect(findLatestResultForModel({ modelName: 'DeepCORO-JEPA' }, [older, newer])).toBe(newer);
  });
});

describe('isResultForPendingRun', () => {
  const pending: PendingViewerModelRun = {
    key: 'model-1',
    studyInstanceUID: '1.2.3',
    modelId: 'model-1',
    containerId: 'container-1',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '1.3.0',
    runId: 'run-2',
    executionId: 'execution-2',
    requestedAt: Date.parse('2026-11-13T10:00:00Z'),
    baselineCompletedAt: '2026-11-10T10:00:00Z',
  };

  test('recognizes the run by execution or run id', () => {
    expect(isResultForPendingRun(result({ executionId: 'execution-2' }), pending)).toBe(true);
    expect(isResultForPendingRun(result({ runId: 'run-2' }), pending)).toBe(true);
    expect(
      isResultForPendingRun(
        result({ runId: 'run-1', executionId: 'execution-1', completedAt: '2026-11-13T11:00:00Z' }),
        pending
      )
    ).toBe(false);
  });

  test('recognizes any newer result for an already active run with unknown ids', () => {
    const unknownRun = { ...pending, runId: null, executionId: null };
    expect(
      isResultForPendingRun(
        result({ runId: 'run-9', completedAt: '2026-11-13T11:00:00Z' }),
        unknownRun
      )
    ).toBe(true);
    expect(isResultForPendingRun(result({ runId: 'run-1' }), unknownRun)).toBe(false);
  });

  test('uses completion time for rows without run identifiers', () => {
    expect(isResultForPendingRun(result({ completedAt: '2026-11-10T10:00:00Z' }), pending)).toBe(
      false
    );
    expect(isResultForPendingRun(result({ completedAt: '2026-11-13T10:05:00Z' }), pending)).toBe(
      true
    );
  });
});

describe('findPendingRunFailure', () => {
  const pending = {
    runId: 'run-2',
    executionId: 'execution-2',
  } as PendingViewerModelRun;
  const status = (
    executionStatus: string | null,
    phase = 'PROCESSING',
    outcome: string | null = null
  ) => ({
    phase,
    outcome,
    executions: [
      { executionId: 'execution-1', status: 'completed' },
      ...(executionStatus ? [{ executionId: 'execution-2', status: executionStatus }] : []),
    ],
  });

  test('reports the failed, cancelled or skipped execution of the run', () => {
    expect(findPendingRunFailure(status('failed'), pending)).toBe('failed');
    expect(findPendingRunFailure(status('cancelled'), pending)).toBe('failed');
    expect(findPendingRunFailure(status('skipped'), pending)).toBe('skipped');
  });

  test('keeps waiting while the execution is active or its result is being stored', () => {
    expect(findPendingRunFailure(status('queued'), pending)).toBeNull();
    expect(findPendingRunFailure(status('running'), pending)).toBeNull();
    expect(findPendingRunFailure(status('completed', 'TERMINAL', 'NO_RESULT'), pending)).toBeNull();
  });

  test('uses the terminal run outcome when the execution is not identified', () => {
    expect(findPendingRunFailure(status(null, 'TERMINAL', 'FAILED'), pending)).toBe('failed');
    expect(findPendingRunFailure(status(null, 'TERMINAL', 'SUCCESS'), pending)).toBeNull();
    expect(findPendingRunFailure(status(null, 'PROCESSING', null), pending)).toBeNull();
  });

  test('uses the only execution when the run request returned no execution id', () => {
    expect(
      findPendingRunFailure(
        {
          phase: 'TERMINAL',
          outcome: 'FAILED',
          executions: [{ executionId: 'x', status: 'skipped' }],
        },
        { ...pending, executionId: null }
      )
    ).toBe('skipped');
  });
});

describe('selected view badges', () => {
  const displaySets = [
    {
      displaySetInstanceUID: 'ds-1',
      SeriesInstanceUID: 'series-1',
      instances: [{ SOPInstanceUID: 'sop-1' }],
    },
    {
      displaySetInstanceUID: 'ds-2',
      SeriesInstanceUID: 'series-1',
      instances: [{ SOPInstanceUID: 'sop-2' }],
    },
    {
      displaySetInstanceUID: 'ds-3',
      SeriesInstanceUID: 'series-2',
      instances: [{ SOPInstanceUID: 'sop-3' }],
    },
  ];

  test('matches the first instance SOP UID of each multiframe display set', () => {
    expect(
      findDisplaySetsForSelectedView(
        view({ sopInstanceUID: 'sop-2', seriesInstanceUID: 'series-1' }),
        displaySets
      ).map(ds => ds.displaySetInstanceUID)
    ).toEqual(['ds-2']);
  });

  test('falls back to the series UID only when no SOP UID matches', () => {
    expect(
      findDisplaySetsForSelectedView(
        view({ sopInstanceUID: 'missing', seriesInstanceUID: 'series-2' }),
        displaySets
      ).map(ds => ds.displaySetInstanceUID)
    ).toEqual(['ds-3']);
    expect(
      findDisplaySetsForSelectedView(view({ sopInstanceUID: 'missing' }), displaySets)
    ).toEqual([]);
  });

  test('numbers badges in selection order and keeps null labels', () => {
    expect(
      buildSelectedViewBadges(
        [
          view({ sopInstanceUID: 'sop-3', viewLabel: 'RAO caudal' }),
          view({ sopInstanceUID: 'sop-1' }),
        ],
        displaySets
      )
    ).toEqual({
      'ds-3': { number: 1, viewLabel: 'RAO caudal' },
      'ds-1': { number: 2, viewLabel: null },
    });
    expect(buildSelectedViewBadges(null, displaySets)).toEqual({});
  });
});

describe('resolveResultSeriesScope', () => {
  const cine = (series: string, number: number, extra: Record<string, unknown> = {}) => ({
    StudyInstanceUID: '1.2.3',
    SeriesInstanceUID: series,
    Modality: 'XA',
    SeriesNumber: number,
    SeriesDescription: `Run ${number}`,
    numImageFrames: 60,
    isMultiFrame: true,
    ...extra,
  });
  const loaded = [
    cine('series-1', 1),
    // A second display set of the same series counts once.
    cine('series-1', 1),
    cine('series-2', 2),
    cine('series-3', 3),
    cine('series-4', 4, { SeriesDescription: '' }),
    // Not counted: another modality, a report, a still, another study.
    cine('ecg-1', 9, { Modality: 'ECG' }),
    cine('report-1', 10, { SeriesDescription: 'Rapport final' }),
    cine('still-1', 11, { numImageFrames: 1, isMultiFrame: false }),
    cine('other-study', 12, { StudyInstanceUID: '9.9.9' }),
  ];
  const scope = (dispatchSeriesInstanceUIDs: string[] | null | undefined, displaySets = loaded) =>
    resolveResultSeriesScope(
      { studyInstanceUID: '1.2.3', dispatchSeriesInstanceUIDs },
      displaySets
    );

  test('is unknown when the backend does not report the dispatched series', () => {
    expect(scope(undefined)).toBeNull();
  });

  test('a run without a recorded list covers all series', () => {
    expect(scope(null)).toEqual({ kind: 'all', series: [] });
    expect(scope([])).toEqual({ kind: 'all', series: [] });
  });

  test('a run on fewer series than the viewer offers is a subset', () => {
    expect(scope(['series-2', 'series-4'])).toEqual({
      kind: 'subset',
      used: 2,
      total: 4,
      series: [
        { seriesInstanceUID: 'series-2', seriesNumber: '2', description: 'Run 2' },
        { seriesInstanceUID: 'series-4', seriesNumber: '4', description: null },
      ],
    });
  });

  test('a run requested from the viewer on every series is not a subset', () => {
    // study-service also dispatches series the pop-up would not offer.
    const all = scope(['series-1', 'series-2', 'series-3', 'series-4', 'still-1', 'report-1']);
    expect(all?.kind).toBe('all');
    expect(all?.series).toHaveLength(6);
    expect(scope(['series-1', 'series-2', 'series-3', 'series-4'])?.kind).toBe('all');
  });

  test('counts used series the viewer has not loaded in the total', () => {
    expect(scope(['series-1', 'not-loaded'])).toMatchObject({ kind: 'subset', used: 2, total: 5 });
  });

  test('only reports the count when none of the used series is loaded', () => {
    expect(scope(['a', 'b'])).toEqual({ kind: 'count', used: 2, series: [] });
    expect(scope(['series-1'], [])).toEqual({ kind: 'count', used: 1, series: [] });
  });
});
