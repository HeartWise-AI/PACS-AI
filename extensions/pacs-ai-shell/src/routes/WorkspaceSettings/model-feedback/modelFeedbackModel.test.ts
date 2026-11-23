import type { ModelFeedbackListItem } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import {
  approvalRatio,
  dateInputToRFC3339,
  feedbackCSVRows,
  feedbackUserLabel,
  filterFeedbackItems,
  formatFeedbackAnswers,
  modelLabel,
} from './modelFeedbackModel';

function item(overrides: Partial<ModelFeedbackListItem> = {}): ModelFeedbackListItem {
  return {
    id: 'feedback-1',
    userId: 'user-1',
    userName: 'Synthetic Reader',
    userEmail: 'reader@example.invalid',
    inferenceModelId: 'deepcoro-info',
    modelId: 'deepcoro-info-1.3.0',
    modelVersion: '1.3.0',
    feedbackType: 'APPROVE',
    createdAt: 1_700_000_000,
    updatedAt: 1_700_000_600,
    runId: 'run-1',
    executionId: 'execution-1',
    studyServiceJobId: '',
    answers: [],
    ...overrides,
  };
}

const labels = {
  headers: {
    updatedAt: 'Updated at',
    createdAt: 'Created at',
    model: 'Model',
    modelId: 'Model ID',
    version: 'Version',
    vote: 'Vote',
    reason: 'Rejection reason',
    userName: 'User name',
    userEmail: 'User email',
    userId: 'User ID',
    runId: 'Run ID',
    executionId: 'Execution ID',
    studyServiceJobId: 'Study-service job ID',
    answers: 'Answers',
  },
  vote: (type: string) => (type === 'APPROVE' ? 'Approved' : 'Rejected'),
  model: (id: string) => (id === 'deepcoro-info' ? 'DeepCORO-JEPA' : id),
  reason: (entry: ModelFeedbackListItem) => (entry.feedbackType === 'REJECT' ? 'Other' : ''),
};

describe('modelLabel', () => {
  test('uses the available model name, else the id', () => {
    const models = [{ modelId: 'deepcoro-info', modelName: 'DeepCORO-JEPA' }];
    expect(modelLabel('deepcoro-info', models)).toBe('DeepCORO-JEPA');
    expect(modelLabel('retired-info', models)).toBe('retired-info');
    expect(modelLabel('deepcoro-info', [])).toBe('deepcoro-info');
  });
});

describe('approvalRatio', () => {
  test('is the share of approvals, and null without votes', () => {
    expect(approvalRatio({ approveCount: 3, rejectCount: 1 })).toBe(0.75);
    expect(approvalRatio({ approveCount: 0, rejectCount: 2 })).toBe(0);
    expect(approvalRatio({ approveCount: 0, rejectCount: 0 })).toBeNull();
  });
});

describe('feedbackUserLabel', () => {
  test('falls back from name to email to id', () => {
    expect(feedbackUserLabel(item())).toBe('Synthetic Reader');
    expect(feedbackUserLabel(item({ userName: null }))).toBe('reader@example.invalid');
    expect(feedbackUserLabel(item({ userName: ' ', userEmail: null }))).toBe('user-1');
  });
});

describe('filterFeedbackItems', () => {
  const items = [
    item(),
    item({
      id: 'feedback-2',
      feedbackType: 'REJECT',
      userName: null,
      userEmail: 'other@x.invalid',
    }),
  ];

  test('filters by vote', () => {
    expect(
      filterFeedbackItems(items, { feedbackType: 'REJECT', userSearch: '' }).map(entry => entry.id)
    ).toEqual(['feedback-2']);
    expect(filterFeedbackItems(items, { feedbackType: '', userSearch: '' })).toHaveLength(2);
  });

  test('searches the user name, email and id, ignoring case', () => {
    expect(
      filterFeedbackItems(items, { feedbackType: '', userSearch: 'SYNTHETIC' }).map(e => e.id)
    ).toEqual(['feedback-1']);
    expect(
      filterFeedbackItems(items, { feedbackType: '', userSearch: 'other@' }).map(e => e.id)
    ).toEqual(['feedback-2']);
    expect(filterFeedbackItems(items, { feedbackType: '', userSearch: 'user-1' })).toHaveLength(2);
  });
});

describe('dateInputToRFC3339', () => {
  test('gives the start or end of the local day', () => {
    expect(dateInputToRFC3339('2026-11-01')).toBe(new Date(2026, 10, 1).toISOString());
    expect(dateInputToRFC3339('2026-11-01', true)).toBe(
      new Date(2026, 10, 1, 23, 59, 59, 999).toISOString()
    );
    expect(dateInputToRFC3339('')).toBeUndefined();
    expect(dateInputToRFC3339('not a date')).toBeUndefined();
  });
});

describe('feedbackCSVRows', () => {
  test('writes a header and one row per vote with flattened answers', () => {
    const rows = feedbackCSVRows(
      [
        item({
          feedbackType: 'REJECT',
          answers: [
            {
              questionnaireId: 'q1',
              questionnaireQuestion: 'What was wrong?',
              questionnaireAnswerIds: ['a', 'b'],
              questionnaireAnswers: ['Wrong vessel', 'Missed stenosis'],
            },
            {
              questionnaireId: 'q2',
              questionnaireQuestion: 'Comment',
              questionnaireAnswerIds: [],
              questionnaireAnswers: ['Too slow'],
            },
          ],
        }),
      ],
      labels
    );

    expect(rows[0]).toEqual(Object.values(labels.headers));
    expect(rows[1]).toEqual([
      new Date(1_700_000_600 * 1000).toISOString(),
      new Date(1_700_000_000 * 1000).toISOString(),
      'DeepCORO-JEPA',
      'deepcoro-info-1.3.0',
      '1.3.0',
      'Rejected',
      'Other',
      'Synthetic Reader',
      'reader@example.invalid',
      'user-1',
      'run-1',
      'execution-1',
      '',
      'What was wrong?: Wrong vessel | Missed stenosis; Comment: Too slow',
    ]);
  });

  test('neutralises cells a spreadsheet would run as a formula', () => {
    const rows = feedbackCSVRows(
      [
        item({
          userName: '=HYPERLINK("http://example.invalid")',
          answers: [
            {
              questionnaireId: 'q1',
              questionnaireQuestion: '@SUM(A1)',
              questionnaireAnswerIds: [],
              questionnaireAnswers: ['x'],
            },
          ],
        }),
      ],
      labels
    );

    expect(rows[1][7]).toBe('\'=HYPERLINK("http://example.invalid")');
    expect(rows[1][13]).toBe("'@SUM(A1): x");
  });

  test('formats a vote without answers as empty', () => {
    expect(formatFeedbackAnswers([])).toBe('');
  });
});
