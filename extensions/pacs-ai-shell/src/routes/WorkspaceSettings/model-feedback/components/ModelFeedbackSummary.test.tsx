import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ModelFeedbackSummary from './ModelFeedbackSummary';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) =>
      key.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(options[name] ?? '')),
  }),
}));

describe('ModelFeedbackSummary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const all = (id: string) =>
    Array.from(container.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));

  test('shows the counts and bar widths per model version', () => {
    act(() => {
      root.render(
        <ModelFeedbackSummary
          summary={[
            {
              modelId: 'deepcoro-info-1.3.0',
              inferenceModelId: 'deepcoro-info',
              version: '1.3.0',
              approveCount: 3,
              rejectCount: 1,
              lastUpdatedAt: 1,
            },
            {
              modelId: 'legacy',
              inferenceModelId: 'legacy',
              version: '',
              approveCount: 0,
              rejectCount: 0,
              lastUpdatedAt: 1,
            },
          ]}
          modelName={id => (id === 'deepcoro-info' ? 'DeepCORO-JEPA' : id)}
        />
      );
    });

    const rows = all('model-feedback-summary-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('DeepCORO-JEPA');
    expect(rows[0].textContent).toContain('v1.3.0');
    expect(all('model-feedback-approve-count')[0].textContent).toBe('3 approved');
    expect(all('model-feedback-reject-count')[0].textContent).toBe('1 rejected');
    expect(all('model-feedback-approve-bar')[0].style.width).toBe('75%');
    expect(all('model-feedback-reject-bar')[0].style.width).toBe('25%');
    expect(rows[0].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      '3 approved, 1 rejected (75% approved)'
    );

    expect(rows[1].textContent).toContain('legacy');
    expect(rows[1].textContent).not.toContain('legacy v');
    expect(all('model-feedback-approve-bar')[1].style.width).toBe('0%');
    expect(rows[1].querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('No votes');
  });

  test('renders nothing without entries', () => {
    act(() => {
      root.render(
        <ModelFeedbackSummary
          summary={[]}
          modelName={id => id}
        />
      );
    });
    expect(container.innerHTML).toBe('');
  });
});
