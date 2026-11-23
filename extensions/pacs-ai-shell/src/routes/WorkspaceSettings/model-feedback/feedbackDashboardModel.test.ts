import type {
  FeedbackReportCount,
  ModelFeedbackListItem,
} from '@pacs-ai/extension-core/src/api/inferenceDTO';
import {
  ALL_FILTERS,
  buildDashboard,
  filterOptions,
  filterVotes,
  rangeWindow,
  rejectReasonId,
  type DashboardModelSource,
} from './feedbackDashboardModel';

const NOW = new Date(2026, 7, 3, 15, 0, 0);
const DAY = 24 * 60 * 60;

const availableModels: DashboardModelSource[] = [
  {
    modelId: 'echo',
    modelName: 'ECHO-PRIME',
    version: '1.0',
    supportedDicomModalities: ['US'],
    outputMode: 'HTML',
  },
  {
    modelId: 'coro',
    modelName: 'DeepCORO-JEPA',
    version: '1.3.0',
    supportedDicomModalities: ['XA'],
    outputMode: 'JSON',
  },
  {
    modelId: 'idle',
    modelName: 'Idle model',
    version: '0.1',
    supportedDicomModalities: ['CT'],
    outputMode: 'PDF',
  },
];

let nextId = 0;
function vote(overrides: Partial<ModelFeedbackListItem> = {}): ModelFeedbackListItem {
  nextId += 1;
  return {
    id: `vote-${nextId}`,
    userId: 'reader-1',
    userName: 'Reader One',
    userEmail: 'one@example.invalid',
    inferenceModelId: 'echo',
    modelId: 'echo-1.0',
    modelVersion: '1.0',
    feedbackType: 'APPROVE',
    createdAt: 0,
    updatedAt: Math.floor(NOW.getTime() / 1000) - DAY,
    runId: `run-${nextId}`,
    executionId: `execution-${nextId}`,
    studyServiceJobId: '',
    answers: [],
    ...overrides,
  };
}

function reject(reasonId: string | null, overrides: Partial<ModelFeedbackListItem> = {}) {
  return vote({
    feedbackType: 'REJECT',
    answers: reasonId
      ? [
          {
            questionnaireId: 'default-reject-reason',
            questionnaireQuestion: 'Why did you reject this output?',
            questionnaireAnswerIds: [reasonId],
            questionnaireAnswers: [reasonId],
          },
        ]
      : [],
    ...overrides,
  });
}

const daysAgo = (days: number) => Math.floor(NOW.getTime() / 1000) - days * DAY;
const noCounts = { current: null, prior: null };

function build(
  items: ModelFeedbackListItem[],
  options: {
    filters?: typeof ALL_FILTERS;
    reportCounts?: { current: FeedbackReportCount[] | null; prior: FeedbackReportCount[] | null };
  } = {}
) {
  return buildDashboard({
    items,
    availableModels,
    filters: options.filters ?? ALL_FILTERS,
    window: rangeWindow('90d', NOW),
    reportCounts: options.reportCounts ?? noCounts,
  });
}

describe('rangeWindow', () => {
  test('90 days is 13 whole weeks ending tonight', () => {
    const window = rangeWindow('90d', NOW);
    expect(window.to).toEqual(new Date(2026, 7, 4));
    expect(window.from).toEqual(new Date(2026, 4, 5));
    expect(window.priorFrom).toEqual(new Date(2026, 1, 3));
    expect(window.bucketStarts).toHaveLength(13);
    expect(window.bucketStarts[0]).toEqual(window.from);
    expect(window.bucketStarts[12]).toEqual(new Date(2026, 6, 28));
  });

  test('30 days has a partial oldest bucket', () => {
    const window = rangeWindow('30d', NOW);
    expect(window.bucketStarts).toHaveLength(5);
    expect(window.bucketStarts[0]).toEqual(window.from);
    expect(window.bucketStarts[1]).toEqual(new Date(2026, 6, 7));
  });

  test('12 months is 52 weeks', () => {
    expect(rangeWindow('12m', NOW).bucketStarts).toHaveLength(52);
  });
});

describe('buildDashboard', () => {
  test('an empty set gives nulls, zeros and the six reasons', () => {
    const dashboard = build([]);
    expect(dashboard.kpis).toMatchObject({
      approvalRate: null,
      approvalDeltaPts: null,
      total: 0,
      totalDeltaPct: null,
      modelsRated: 0,
      modelsDeployed: 3,
      modelsUnrated: 3,
      reportsRated: 0,
      reportsReturned: null,
      reportsRatedPct: null,
    });
    expect(dashboard.weeks).toHaveLength(13);
    expect(dashboard.weeks.every(week => week.rate === null)).toBe(true);
    expect(dashboard.reasons.map(reason => reason.id)).toEqual([
      'missed-finding',
      'measurement-disagrees',
      'text-unclear',
      'wrong-series-laterality',
      'too-slow',
      'other',
    ]);
    expect(dashboard.models).toEqual([]);
    expect(dashboard.scale).toEqual({ min: 50, max: 100 });
  });

  test('eight thumbs up: 100%, no flags, no prior deltas', () => {
    const items = Array.from({ length: 8 }, () => vote());
    const dashboard = build(items);
    expect(dashboard.kpis.approvalRate).toBe(1);
    expect(dashboard.kpis.total).toBe(8);
    expect(dashboard.kpis.down).toBe(0);
    expect(dashboard.kpis.approvalDeltaPts).toBeNull();
    expect(dashboard.kpis.totalDeltaPct).toBeNull();
    expect(dashboard.kpis.reportsRated).toBe(8);
    expect(dashboard.reasons.every(reason => reason.count === 0)).toBe(true);
    expect(dashboard.models).toHaveLength(1);
    expect(dashboard.models[0]).toMatchObject({
      name: 'ECHO-PRIME',
      up: 8,
      down: 0,
      rate: 1,
      deltaPts: null,
      topReasonId: null,
      belowThreshold: false,
    });
    expect(dashboard.weeks[12]).toMatchObject({ up: 8, down: 0, rate: 1 });
  });

  test('buckets by update time at the week edges', () => {
    const window = rangeWindow('90d', NOW);
    const at = (date: Date) => Math.floor(date.getTime() / 1000);
    const dashboard = build([
      vote({ updatedAt: at(window.from) }),
      vote({ updatedAt: at(window.bucketStarts[1]) - 1 }),
      vote({ updatedAt: at(window.bucketStarts[1]) }),
      vote({ updatedAt: at(window.to) - 1 }),
      // Outside both periods.
      vote({ updatedAt: at(window.to) }),
    ]);
    expect(dashboard.weeks[0].up).toBe(2);
    expect(dashboard.weeks[1].up).toBe(1);
    expect(dashboard.weeks[12].up).toBe(1);
    expect(dashboard.weeks[12].end).toEqual(new Date(2026, 7, 3));
    expect(dashboard.kpis.total).toBe(4);
  });

  test('deltas compare with the prior period', () => {
    const dashboard = build(
      [
        vote(),
        vote(),
        vote(),
        reject('other'),
        // Prior period: one up, one down.
        vote({ updatedAt: daysAgo(100) }),
        reject('other', { updatedAt: daysAgo(100) }),
      ],
      {
        reportCounts: {
          current: [
            { modelName: 'ECHO-PRIME', modelVersion: '1.0', modality: 'US', completedCount: 40 },
          ],
          prior: [
            { modelName: 'ECHO-PRIME', modelVersion: '1.0', modality: 'US', completedCount: 20 },
          ],
        },
      }
    );
    expect(dashboard.kpis.approvalRate).toBe(0.75);
    expect(dashboard.kpis.approvalDeltaPts).toBeCloseTo(25);
    expect(dashboard.kpis.totalDeltaPct).toBeCloseTo(100);
    expect(dashboard.kpis.reportsReturned).toBe(40);
    expect(dashboard.kpis.reportsRatedPct).toBeCloseTo(0.1);
    expect(dashboard.kpis.reportsDeltaPts).toBeCloseTo(0);
    expect(dashboard.models[0].deltaPts).toBeCloseTo(25);
  });

  test('distinct reports count execution, else run', () => {
    const dashboard = build([
      vote({ executionId: 'e1', userId: 'a' }),
      vote({ executionId: 'e1', userId: 'b' }),
      vote({ executionId: '', runId: 'r1' }),
    ]);
    expect(dashboard.kpis.reportsRated).toBe(2);
  });

  test('rejects without a default answer are unspecified so reasons sum to thumbs down', () => {
    const dashboard = build([reject('missed-finding'), reject(null), reject('bogus')]);
    const sum = dashboard.reasons.reduce((total, reason) => total + reason.count, 0);
    expect(sum).toBe(dashboard.kpis.down);
    expect(dashboard.reasons.at(-1)).toEqual({ id: 'unspecified', count: 2 });
    expect(dashboard.reasons[0]).toEqual({ id: 'missed-finding', count: 1 });
  });

  test('top reason per model, ties to questionnaire order', () => {
    const dashboard = build([
      reject('too-slow'),
      reject('text-unclear'),
      reject('too-slow'),
      reject('measurement-disagrees', { inferenceModelId: 'coro' }),
      reject('missed-finding', { inferenceModelId: 'coro' }),
    ]);
    const byId = Object.fromEntries(dashboard.models.map(model => [model.inferenceModelId, model]));
    expect(byId.echo.topReasonId).toBe('too-slow');
    expect(byId.coro.topReasonId).toBe('missed-finding');
  });

  test('models are sorted by volume and flagged below the threshold', () => {
    const dashboard = build([
      vote({ inferenceModelId: 'coro' }),
      reject('other', { inferenceModelId: 'coro' }),
      reject('other', { inferenceModelId: 'coro' }),
      vote(),
    ]);
    expect(dashboard.models.map(model => model.inferenceModelId)).toEqual(['coro', 'echo']);
    expect(dashboard.models[0].belowThreshold).toBe(true);
    expect(dashboard.models[1].belowThreshold).toBe(false);
    expect(dashboard.kpis.modelsUnrated).toBe(1);
    expect(dashboard.scale.min).toBe(30);
  });

  test('the modality filter narrows votes, deployed models and report counts', () => {
    const counts = {
      current: [
        { modelName: 'ECHO-PRIME', modelVersion: '1.0', modality: 'US', completedCount: 10 },
        { modelName: 'DeepCORO-JEPA', modelVersion: '1.3.0', modality: 'XA', completedCount: 5 },
      ],
      prior: null,
    };
    const dashboard = build([vote(), vote({ inferenceModelId: 'coro' })], {
      filters: { ...ALL_FILTERS, modality: 'xa' },
      reportCounts: counts,
    });
    expect(dashboard.kpis.total).toBe(1);
    expect(dashboard.kpis.modelsDeployed).toBe(1);
    expect(dashboard.kpis.reportsReturned).toBe(5);
  });

  test('the output-mode filter applies to report counts by model name', () => {
    const dashboard = build([vote()], {
      filters: { ...ALL_FILTERS, outputMode: 'HTML' },
      reportCounts: {
        current: [
          { modelName: 'ECHO-PRIME', modelVersion: '1.0', modality: 'US', completedCount: 10 },
          { modelName: 'Unknown', modelVersion: '', modality: 'US', completedCount: 99 },
        ],
        prior: null,
      },
    });
    expect(dashboard.kpis.reportsReturned).toBe(10);
  });
});

describe('filterVotes', () => {
  test('the reader filter matches the user id', () => {
    const items = [vote({ userId: 'a' }), vote({ userId: 'b' })];
    expect(filterVotes(items, { ...ALL_FILTERS, reader: 'b' }, availableModels)).toHaveLength(1);
  });

  test('votes for unknown models pass only with no model filter', () => {
    const items = [vote({ inferenceModelId: 'retired' })];
    expect(filterVotes(items, ALL_FILTERS, availableModels)).toHaveLength(1);
    expect(filterVotes(items, { ...ALL_FILTERS, modality: 'US' }, availableModels)).toHaveLength(0);
    expect(
      filterVotes(items, { ...ALL_FILTERS, outputMode: 'HTML' }, availableModels)
    ).toHaveLength(0);
  });
});

describe('filterOptions', () => {
  test('lists modalities, output modes and readers', () => {
    const options = filterOptions(
      [vote({ userId: 'b', userName: 'Zed' }), vote({ userId: 'a', userName: 'Amy' })],
      availableModels
    );
    expect(options.modalities).toEqual(['CT', 'US', 'XA']);
    expect(options.outputModes).toEqual(['HTML', 'JSON', 'PDF']);
    expect(options.readers).toEqual([
      { id: 'a', label: 'Amy' },
      { id: 'b', label: 'Zed' },
    ]);
  });
});

describe('rejectReasonId', () => {
  test('reads the default questionnaire answer', () => {
    expect(rejectReasonId(reject('too-slow'))).toBe('too-slow');
    expect(rejectReasonId(reject(null))).toBe('unspecified');
  });
});
