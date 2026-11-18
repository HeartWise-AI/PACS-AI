import React from 'react';
import { render, screen } from '@testing-library/react';
import { studyProcessingSummaryFixtures } from '@pacs-ai/extension-core/src/studyProcessing/fixtures';
import { StudyProcessingStatusCell } from './StudyProcessingStatusCell';
import { getStudyProcessingStatusPresentation } from './statusPresentation';

jest.mock('@ohif/ui-next', () => ({
  Icons: { StatusWarning: 'span' },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => {
      let translation = String(options.defaultValue ?? key);

      Object.entries(options).forEach(([name, value]) => {
        translation = translation.replace(`{{${name}}}`, String(value));
      });

      return translation;
    },
  }),
}));

describe('StudyProcessingStatusCell', () => {
  test.each([
    ['waiting', 'Waiting'],
    ['retrieving', 'Retrieving'],
    ['queued', 'Queued'],
    ['processing', 'Processing'],
    ['success', 'Success'],
    ['successWithSkips', 'Success with skips'],
    ['partialSuccess', 'Partial success'],
    ['noResult', 'No result'],
    ['failed', 'Failed'],
    ['cancelled', 'Cancelled'],
  ] as const)('maps the %s fixture to the %s status', (fixtureName, expectedLabel) => {
    expect(
      getStudyProcessingStatusPresentation(studyProcessingSummaryFixtures[fixtureName]).label
    ).toBe(expectedLabel);
  });

  it('renders completed versus expected model progress', () => {
    const { container, unmount } = render(
      <StudyProcessingStatusCell summary={studyProcessingSummaryFixtures.processing} />
    );

    const progressBars = container.querySelectorAll('[role="progressbar"]');
    expect(progressBars).toHaveLength(1);
    const progress = progressBars[0];
    const modelCount = screen.getByTestId('study-processing-model-count');

    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('3');
    expect(modelCount.textContent).toBe('1 / 3 models');
    expect(screen.getByTestId('study-processing-progress-fill').style.width).toBe('33%');

    unmount();
  });

  it('shows attention without replacing the run outcome', () => {
    const { unmount } = render(
      <StudyProcessingStatusCell summary={studyProcessingSummaryFixtures.partialSuccess} />
    );

    const statusLabel = screen.getByTestId('study-processing-status-label');
    const attention = screen.getByTestId('study-processing-attention');

    expect(Array.from(statusLabel.childNodes, node => node.textContent)).toContain(
      'Partial success'
    );
    expect(attention.getAttribute('aria-label')).toBe('Processing requires attention');

    unmount();
  });
});
