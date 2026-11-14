import {
  buildSelectedViewBadges,
  findDisplaySetsForSelectedView,
  findLatestResultForModel,
  isResultForPendingRun,
} from './viewerResultsModel';
import type { PendingViewerModelRun, SelectedView, ViewerModelResult } from './types';

function result(overrides: Partial<ViewerModelResult>): ViewerModelResult {
  return {
    studyInstanceUID: '1.2.3',
    modelName: 'DeepCORO-JEPA',
    modelVersion: '1.3.0',
    modality: 'angiogram',
    modelId: null,
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

  test('uses completion time for rows without run identifiers', () => {
    expect(isResultForPendingRun(result({ completedAt: '2026-11-10T10:00:00Z' }), pending)).toBe(
      false
    );
    expect(isResultForPendingRun(result({ completedAt: '2026-11-13T10:05:00Z' }), pending)).toBe(
      true
    );
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
