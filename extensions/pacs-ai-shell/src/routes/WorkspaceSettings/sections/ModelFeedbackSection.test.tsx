import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import type { ModelFeedbackListItem } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import ModelFeedbackSection from './ModelFeedbackSection';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(options[name] ?? '')),
    i18n: { language: 'en-US' },
  }),
}));
jest.mock('@pacs-ai/extension-core/src/service/userService', () => ({ logoutUser: jest.fn() }));
jest.mock('@pacs-ai/extension-core/src/api/inferenceRepository', () => ({
  __esModule: true,
  default: { ListModelFeedback: jest.fn(), ListFeedbackReportCounts: jest.fn() },
}));

const listModelFeedback = inferenceRepository.ListModelFeedback as jest.Mock;
const listReportCounts = inferenceRepository.ListFeedbackReportCounts as jest.Mock;

const NOW = new Date(2026, 7, 3, 15, 0, 0);
const DAY = 24 * 60 * 60;
const daysAgo = (days: number) => Math.floor(NOW.getTime() / 1000) - days * DAY;
const clock = () => new Date(NOW);

let nextId = 0;
function vote(overrides: Partial<ModelFeedbackListItem> = {}): ModelFeedbackListItem {
  nextId += 1;
  return {
    id: `vote-${nextId}`,
    userId: 'user-1',
    userName: 'Synthetic Reader',
    userEmail: 'reader@example.invalid',
    inferenceModelId: 'deepcoro-info',
    modelId: 'deepcoro-info-1.3.0',
    modelVersion: '1.3.0',
    feedbackType: 'APPROVE',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    runId: `run-${nextId}`,
    executionId: `execution-${nextId}`,
    studyServiceJobId: '',
    answers: [],
    ...overrides,
  };
}

function reject(reasonId: string, overrides: Partial<ModelFeedbackListItem> = {}) {
  return vote({
    feedbackType: 'REJECT',
    userId: 'user-2',
    userName: null,
    userEmail: 'other@example.invalid',
    answers: [
      {
        questionnaireId: 'default-reject-reason',
        questionnaireQuestion: 'Why did you reject this output?',
        questionnaireAnswerIds: [reasonId],
        questionnaireAnswers: [reasonId],
      },
    ],
    ...overrides,
  });
}

const availableModels = [
  {
    modelId: 'deepcoro-info',
    modelName: 'DeepCORO-JEPA',
    version: '1.3.0',
    supportedDicomModalities: ['XA'],
    outputMode: 'JSON',
  },
  {
    modelId: 'echo',
    modelName: 'ECHO-PRIME',
    version: '1.0',
    supportedDicomModalities: ['US'],
    outputMode: 'HTML',
  },
] as never[];

function feedbackResponse(items: ModelFeedbackListItem[], truncated = false) {
  return { data: { summary: [], items, truncated } };
}

const denseItems = () => [
  vote(),
  vote(),
  vote(),
  reject('wrong-series-laterality'),
  vote({ inferenceModelId: 'echo', modelId: 'echo-1.0', modelVersion: '1.0' }),
  // Prior period.
  vote({ updatedAt: daysAgo(120) }),
  reject('other', { updatedAt: daysAgo(120) }),
];

describe('ModelFeedbackSection', () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveFile = jest.fn();

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    listModelFeedback.mockReset().mockResolvedValue(feedbackResponse(denseItems()));
    listReportCounts.mockReset().mockImplementation(({ from }: { from: string }) =>
      Promise.resolve({
        data: {
          models: [
            {
              modelName: 'DeepCORO-JEPA',
              modelVersion: '1.3.0',
              modality: 'XA',
              completedCount: from === new Date(2026, 4, 5).toISOString() ? 40 : 20,
            },
          ],
        },
      })
    );
    saveFile.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(active = true) {
    await act(async () => {
      root.render(
        <ModelFeedbackSection
          active={active}
          availableModels={availableModels}
          tenantName="Synthetic Hospital"
          saveFile={saveFile}
          clock={clock}
        />
      );
    });
  }

  const all = (id: string) =>
    Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  const one = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

  test('loads only while the tab is active, covering the prior period too', async () => {
    await render(false);
    expect(listModelFeedback).not.toHaveBeenCalled();
    expect(listReportCounts).not.toHaveBeenCalled();

    await render(true);
    expect(listModelFeedback).toHaveBeenCalledTimes(1);
    expect(listModelFeedback).toHaveBeenCalledWith({
      from: new Date(2026, 1, 3).toISOString(),
      to: new Date(2026, 7, 4).toISOString(),
    });
    expect(listReportCounts).toHaveBeenCalledWith({
      from: new Date(2026, 4, 5).toISOString(),
      to: new Date(2026, 7, 4).toISOString(),
    });
    expect(listReportCounts).toHaveBeenCalledWith({
      from: new Date(2026, 1, 3).toISOString(),
      to: new Date(2026, 4, 5).toISOString(),
    });
    expect(one('model-feedback-subtitle').textContent).toBe(
      'Reader ratings on inference output · Tenant Synthetic Hospital · 13 weeks to 3 Aug 2026'
    );
  });

  test('shows the KPI values with prior-period deltas', async () => {
    await render();

    expect(one('model-feedback-kpi-approval').textContent).toContain('80.0%');
    // 50% before, 80% now.
    expect(one('model-feedback-kpi-approval-delta').textContent).toBe('▲30.0 pts vs prior 90 days');
    expect(one('model-feedback-kpi-total').textContent).toContain('5');
    expect(one('model-feedback-kpi-total').textContent).toContain('4 up · 1 down');
    expect(one('model-feedback-kpi-total-delta').textContent).toBe('▲150% vs prior 90 days');
    expect(one('model-feedback-kpi-models').textContent).toContain('of 2 deployed');
    expect(one('model-feedback-kpi-models').textContent).toContain(
      'Every deployed model has ratings'
    );
    expect(one('model-feedback-kpi-reports').textContent).toContain('12.5%');
    expect(one('model-feedback-kpi-reports').textContent).toContain('5 of 40 reports returned');
    expect(all('model-feedback-model-row')).toHaveLength(2);
    expect(all('model-feedback-model-row')[0].textContent).toContain('DeepCORO-JEPA');
    expect(all('model-feedback-model-row')[0].textContent).toContain('Wrong series or laterality');
    expect(all('model-feedback-model-panel')).toHaveLength(2);
  });

  test('the range toggle reloads with the new bounds', async () => {
    await render();

    await act(async () => {
      fireEvent.click(one('model-feedback-range-30d'));
    });

    expect(one('model-feedback-range-30d').getAttribute('aria-checked')).toBe('true');
    expect(listModelFeedback).toHaveBeenLastCalledWith({
      from: new Date(2026, 5, 5).toISOString(),
      to: new Date(2026, 7, 4).toISOString(),
    });
    expect(one('model-feedback-subtitle').textContent).toContain('30 days to 3 Aug 2026');
  });

  test('the filters narrow every panel without a new request', async () => {
    await render();

    await act(async () => {
      fireEvent.change(one('model-feedback-modality-filter'), { target: { value: 'US' } });
    });
    expect(one('model-feedback-kpi-total').textContent).toContain('1 up · 0 down');
    expect(all('model-feedback-model-row')).toHaveLength(1);
    expect(all('model-feedback-model-row')[0].textContent).toContain('ECHO-PRIME');

    await act(async () => {
      fireEvent.change(one('model-feedback-modality-filter'), { target: { value: '' } });
      fireEvent.change(one('model-feedback-reader-filter'), { target: { value: 'user-2' } });
    });
    expect(one('model-feedback-kpi-total').textContent).toContain('0 up · 1 down');
    expect(listModelFeedback).toHaveBeenCalledTimes(1);
  });

  test('sparse data: eight thumbs up, no red, no reasons, no deltas', async () => {
    listModelFeedback.mockResolvedValue(feedbackResponse(Array.from({ length: 8 }, () => vote())));
    await render();

    expect(one('model-feedback-kpi-approval').textContent).toContain('100.0%');
    expect(one('model-feedback-kpi-approval-delta').textContent).toBe(
      'No ratings in the prior 90 days'
    );
    expect(one('model-feedback-reasons-empty')).toBeTruthy();
    expect(all('model-feedback-weekly-down')).toHaveLength(0);
    expect(all('model-feedback-weekly-up')).toHaveLength(1);
    expect(container.innerHTML).not.toContain('#E5484D"');
    expect(container.innerHTML).not.toContain('F2777B');
    expect(one('model-feedback-kpi-models').textContent).toContain('1 models have no ratings yet');
  });

  test('a report-count failure leaves the page rendered with an unknown denominator', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    listReportCounts.mockRejectedValue({ message: 'boom' });
    await render();

    expect(one('model-feedback-kpi-reports').textContent).toContain('—');
    expect(one('model-feedback-kpi-reports').textContent).toContain('Reports returned unavailable');
    expect(one('model-feedback-kpi-reports').textContent).toContain('5 reports rated');
    expect(one('model-feedback-kpi-approval').textContent).toContain('80.0%');
    (console.error as jest.Mock).mockRestore();
  });

  test('exports the current votes as CSV with the rejection reason', async () => {
    await render();

    await act(async () => {
      fireEvent.click(one('model-feedback-export'));
    });

    expect(saveFile).toHaveBeenCalledTimes(1);
    const [fileName, text] = saveFile.mock.calls[0];
    expect(fileName).toBe('model-feedback-2026-08-03.csv');
    const lines = (text as string)
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain('Rejection reason');
    expect(lines.find(line => line.includes('Rejected'))).toContain('Wrong series or laterality');
  });

  test('the votes disclosure lists the current votes and filters them', async () => {
    await render();

    expect(one('model-feedback-votes').tagName).toBe('DETAILS');
    expect(all('model-feedback-row')).toHaveLength(5);

    await act(async () => {
      fireEvent.change(one('model-feedback-vote-filter'), { target: { value: 'REJECT' } });
    });
    expect(all('model-feedback-row')).toHaveLength(1);
    expect(all('model-feedback-row')[0].textContent).toContain('other@example.invalid');

    await act(async () => {
      fireEvent.change(one('model-feedback-vote-filter'), { target: { value: '' } });
      fireEvent.change(one('model-feedback-user-search'), { target: { value: 'nobody' } });
    });
    expect(all('model-feedback-row')).toHaveLength(0);
  });

  test('refresh reloads votes and report counts', async () => {
    await render();
    const before = listReportCounts.mock.calls.length;

    await act(async () => {
      fireEvent.click(one('model-feedback-refresh'));
    });

    expect(listModelFeedback).toHaveBeenCalledTimes(2);
    expect(listReportCounts.mock.calls.length).toBe(before + 2);
  });

  test('shows the truncated notice', async () => {
    listModelFeedback.mockResolvedValue(feedbackResponse(denseItems(), true));
    await render();

    expect(one('model-feedback-truncated').textContent).toContain('7 most recent votes');
  });

  test('shows the empty state', async () => {
    listModelFeedback.mockResolvedValue(feedbackResponse([]));
    await render();

    expect(one('model-feedback-empty')).toBeTruthy();
    expect(all('model-feedback-model-row')).toHaveLength(0);
    expect(one('model-feedback-kpi-approval').textContent).toContain('—');
  });

  test('shows the error state', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    listModelFeedback.mockRejectedValue({ message: 'boom' });
    await render();

    expect(one('model-feedback-error')).toBeTruthy();
    expect(all('model-feedback-model-row')).toHaveLength(0);
    (console.error as jest.Mock).mockRestore();
  });
});
