import {
  findResultForCitation,
  isSameCompletionTime,
  resolveCitationResultActions,
  type ModelResultCitation,
} from './chatCitations';
import type { ViewerModelResult } from './types';

const STUDY_UID = '2.25.900000000000000000000000000000000000001';

function result(overrides: Partial<ViewerModelResult> = {}): ViewerModelResult {
  return {
    studyInstanceUID: STUDY_UID,
    modelName: 'DeepCORO-JEPA',
    modelVersion: '2.0.0',
    modality: 'angiogram',
    modelId: 'model-1',
    artifactModelId: 'deepcoro-jepa',
    containerId: 'container-1',
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: 'job-1',
    completedAt: '2026-11-13T09:00:00-05:00',
    trigger: 'AUTO',
    selectedViews: null,
    reportAvailable: true,
    ...overrides,
  };
}

function citation(overrides: Partial<ModelResultCitation> = {}): ModelResultCitation {
  return {
    modelName: 'DeepCORO-JEPA',
    studyInstanceUID: STUDY_UID,
    studyServiceJobId: 'job-1',
    completedAt: '2026-11-13T09:00:00-05:00',
    ...overrides,
  };
}

describe('findResultForCitation', () => {
  it('matches on study, model name and study-service job', () => {
    const jepa = result();
    const cto = result({ modelName: 'DeepCORO-CTO', studyServiceJobId: 'job-2' });

    expect(findResultForCitation(citation(), [cto, jepa])).toBe(jepa);
    expect(
      findResultForCitation(citation({ modelName: 'DeepCORO-CTO', studyServiceJobId: 'job-2' }), [
        cto,
        jepa,
      ])
    ).toBe(cto);
  });

  it('prefers the job over the completion time', () => {
    const byTime = result({ studyServiceJobId: 'job-0' });
    const byJob = result({ completedAt: '2026-11-14T10:00:00-05:00' });

    expect(findResultForCitation(citation(), [byTime, byJob])).toBe(byJob);
  });

  it('falls back to model name and completion time', () => {
    // A result of an api-pacs run whose study-service job the viewer does not know.
    const stored = result({ studyServiceJobId: null });
    expect(findResultForCitation(citation(), [stored])).toBe(stored);

    // A citation without a job.
    const withJob = result();
    expect(findResultForCitation(citation({ studyServiceJobId: null }), [withJob])).toBe(withJob);

    // A citation without a study: the results held are those of the open study.
    expect(
      findResultForCitation(citation({ studyInstanceUID: null, studyServiceJobId: 'job-9' }), [
        withJob,
      ])
    ).toBe(withJob);
  });

  it('does not match another model, another time or another study', () => {
    const stored = result();

    expect(findResultForCitation(citation({ modelName: 'DeepCORO-CTO' }), [stored])).toBeNull();
    expect(
      findResultForCitation(
        citation({ studyServiceJobId: 'job-9', completedAt: '2026-11-12T09:00:00-05:00' }),
        [stored]
      )
    ).toBeNull();
    expect(findResultForCitation(citation({ studyInstanceUID: '1.2.3' }), [stored])).toBeNull();
    expect(
      findResultForCitation(citation({ studyServiceJobId: 'job-9', completedAt: null }), [stored])
    ).toBeNull();
    expect(findResultForCitation(citation(), [])).toBeNull();
    expect(findResultForCitation(citation({ modelName: ' ' }), [stored])).toBeNull();
  });
});

describe('isSameCompletionTime', () => {
  it('compares the instant whatever the notation', () => {
    expect(isSameCompletionTime('2026-11-13T09:00:00-05:00', '2026-11-13T14:00:00Z')).toBe(true);
    expect(isSameCompletionTime('2026-11-13T09:00:00.250-05:00', '2026-11-13 14:00:00+00:00')).toBe(
      true
    );
    expect(isSameCompletionTime('2026-11-13T09:00:00-05:00', '2026-11-13T09:00:00Z')).toBe(false);
  });

  it('compares a time without a zone with the wall clock of the other', () => {
    expect(isSameCompletionTime('2026-11-13 09:00:00', '2026-11-13T09:00:00')).toBe(true);
    expect(isSameCompletionTime('2026-11-13 09:00:00', '2026-11-13T09:00:00-05:00')).toBe(true);
    expect(isSameCompletionTime('2026-11-13 14:00:00', '2026-11-13T09:00:00-05:00')).toBe(true);
    expect(isSameCompletionTime('2026-11-13 10:00:00', '2026-11-13T09:00:00-05:00')).toBe(false);
  });

  it('never matches a missing or unreadable time, except the same text', () => {
    expect(isSameCompletionTime(null, null)).toBe(false);
    expect(isSameCompletionTime('', '2026-11-13T09:00:00Z')).toBe(false);
    expect(isSameCompletionTime('yesterday', '2026-11-13T09:00:00Z')).toBe(false);
    expect(isSameCompletionTime(' yesterday', 'yesterday ')).toBe(true);
  });
});

describe('resolveCitationResultActions', () => {
  const openResult = jest.fn();
  const loadExecutionResult = jest.fn().mockResolvedValue({ syntax_score: 8 });

  beforeEach(() => {
    openResult.mockClear();
    loadExecutionResult.mockClear();
  });

  it('opens the matched result and loads the raw data of its execution', async () => {
    const stored = result();
    const actions = resolveCitationResultActions(citation(), {
      canViewResults: true,
      results: [stored],
      openResult,
      loadExecutionResult,
    });

    actions.open?.();
    expect(openResult).toHaveBeenCalledWith(stored);
    await expect(actions.loadRawResult?.()).resolves.toEqual({ syntax_score: 8 });
    expect(loadExecutionResult).toHaveBeenCalledWith({
      runId: 'run-1',
      executionId: 'execution-1',
    });
  });

  it('offers no raw data for a result without a model execution', () => {
    const actions = resolveCitationResultActions(citation(), {
      canViewResults: true,
      results: [result({ runId: null, executionId: null })],
      openResult,
      loadExecutionResult,
    });

    expect(actions.open).not.toBeNull();
    expect(actions.loadRawResult).toBeNull();
  });

  it('offers nothing for a result the viewer does not hold', () => {
    expect(
      resolveCitationResultActions(citation({ modelName: 'DeepCORO-CTO' }), {
        canViewResults: true,
        results: [result()],
        openResult,
        loadExecutionResult,
      })
    ).toEqual({ open: null, loadRawResult: null, loading: false });

    expect(
      resolveCitationResultActions(citation(), {
        canViewResults: true,
        results: [],
        resultsLoading: true,
        openResult,
      })
    ).toEqual({ open: null, loadRawResult: null, loading: true });
  });

  it('offers nothing to a user who may not view stored results', () => {
    expect(
      resolveCitationResultActions(citation(), {
        canViewResults: false,
        results: [result()],
        resultsLoading: true,
        openResult,
        loadExecutionResult,
      })
    ).toEqual({ open: null, loadRawResult: null });
  });
});
