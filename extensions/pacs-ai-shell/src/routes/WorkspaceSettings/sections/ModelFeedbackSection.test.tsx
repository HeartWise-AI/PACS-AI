import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import type { ListModelFeedbackResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import ModelFeedbackSection from './ModelFeedbackSection';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(options[name] ?? '')),
  }),
}));
jest.mock('@pacs-ai/extension-core/src/service/userService', () => ({ logoutUser: jest.fn() }));
jest.mock('@pacs-ai/extension-core/src/api/inferenceRepository', () => ({
  __esModule: true,
  default: { ListModelFeedback: jest.fn() },
}));

const listModelFeedback = inferenceRepository.ListModelFeedback as jest.Mock;

const response: ListModelFeedbackResponse = {
  summary: [
    {
      modelId: 'deepcoro-info-1.3.0',
      inferenceModelId: 'deepcoro-info',
      version: '1.3.0',
      approveCount: 1,
      rejectCount: 1,
      lastUpdatedAt: 1_700_000_600,
    },
  ],
  items: [
    {
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
    },
    {
      id: 'feedback-2',
      userId: 'user-2',
      userName: null,
      userEmail: 'other@example.invalid',
      inferenceModelId: 'deepcoro-info',
      modelId: 'deepcoro-info-1.3.0',
      modelVersion: '1.3.0',
      feedbackType: 'REJECT',
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_300,
      runId: 'run-2',
      executionId: 'execution-2',
      studyServiceJobId: '',
      answers: [
        {
          questionnaireId: 'q1',
          questionnaireQuestion: 'What was wrong?',
          questionnaireAnswerIds: ['a'],
          questionnaireAnswers: ['Wrong vessel'],
        },
      ],
    },
  ],
  truncated: false,
};

const availableModels = [{ modelId: 'deepcoro-info', modelName: 'DeepCORO-JEPA' }] as never[];

describe('ModelFeedbackSection', () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveFile = jest.fn();

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    listModelFeedback.mockReset().mockResolvedValue({ data: response });
    saveFile.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function render(active: boolean) {
    await act(async () => {
      root.render(
        <ModelFeedbackSection
          active={active}
          availableModels={availableModels}
          saveFile={saveFile}
        />
      );
    });
  }

  const all = (id: string) =>
    Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  const one = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;

  test('loads only while the tab is active', async () => {
    await render(false);
    expect(listModelFeedback).not.toHaveBeenCalled();

    await render(true);
    expect(listModelFeedback).toHaveBeenCalledTimes(1);
    expect(listModelFeedback).toHaveBeenCalledWith({});
  });

  test('shows the summary and one row per vote', async () => {
    await render(true);

    expect(all('model-feedback-summary-row')).toHaveLength(1);
    expect(one('model-feedback-summary-row').textContent).toContain('DeepCORO-JEPA');
    const rows = all('model-feedback-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Synthetic Reader');
    expect(rows[0].textContent).toContain('run-1');
    expect(rows[1].textContent).toContain('other@example.invalid');
    expect(rows[1].textContent).toContain('What was wrong?: Wrong vessel');
  });

  test('the vote filter narrows the table without a new request', async () => {
    await render(true);

    await act(async () => {
      fireEvent.change(one('model-feedback-vote-filter'), { target: { value: 'REJECT' } });
    });

    const rows = all('model-feedback-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('run-2');
    expect(listModelFeedback).toHaveBeenCalledTimes(1);
  });

  test('the model and date filters reload with the query', async () => {
    await render(true);

    await act(async () => {
      fireEvent.change(one('model-feedback-model-filter'), {
        target: { value: 'deepcoro-info' },
      });
    });
    expect(listModelFeedback).toHaveBeenLastCalledWith({ model: 'deepcoro-info' });

    await act(async () => {
      fireEvent.change(one('model-feedback-from'), { target: { value: '2026-11-01' } });
    });
    expect(listModelFeedback).toHaveBeenLastCalledWith({
      model: 'deepcoro-info',
      from: new Date(2026, 10, 1).toISOString(),
    });
  });

  test('exports the listed votes as CSV', async () => {
    await render(true);

    await act(async () => {
      fireEvent.click(one('model-feedback-export'));
    });

    expect(saveFile).toHaveBeenCalledTimes(1);
    const [fileName, text] = saveFile.mock.calls[0];
    expect(fileName).toMatch(/^model-feedback-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = (text as string)
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('Run ID');
    expect(lines[1]).toContain('DeepCORO-JEPA');
    expect(lines[1]).toContain('Approved');
  });

  test('shows the truncated notice', async () => {
    listModelFeedback.mockResolvedValue({ data: { ...response, truncated: true } });
    await render(true);

    expect(one('model-feedback-truncated').textContent).toContain('2 most recent votes');
  });

  test('shows the empty state', async () => {
    listModelFeedback.mockResolvedValue({ data: { summary: [], items: [], truncated: false } });
    await render(true);

    expect(one('model-feedback-empty')).toBeTruthy();
    expect(all('model-feedback-row')).toHaveLength(0);
  });

  test('shows the error state', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    listModelFeedback.mockRejectedValue({ message: 'boom' });
    await render(true);

    expect(one('model-feedback-error')).toBeTruthy();
    expect(all('model-feedback-row')).toHaveLength(0);
    (console.error as jest.Mock).mockRestore();
  });
});
