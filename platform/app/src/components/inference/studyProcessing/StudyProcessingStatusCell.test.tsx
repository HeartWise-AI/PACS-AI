import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingSummaryFixtures } from './fixtures';
import { StudyProcessingStatusCell } from './StudyProcessingStatusCell';
import { getStudyProcessingStatusPresentation } from './statusPresentation';

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
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingStatusCell summary={studyProcessingSummaryFixtures.processing} />
      );
    });

    const progress = renderer.root.findByProps({ role: 'progressbar' });
    const modelCount = renderer.root.findByProps({
      'data-testid': 'study-processing-model-count',
    });

    expect(progress.props['aria-valuenow']).toBe(1);
    expect(progress.props['aria-valuemax']).toBe(3);
    expect(modelCount.children.join('')).toBe('1 / 3 models');
    expect(
      renderer.root.findByProps({ 'data-testid': 'study-processing-progress-fill' }).props.style
        .width
    ).toBe('33%');

    act(() => {
      renderer.unmount();
    });
  });

  it('shows attention without replacing the run outcome', () => {
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingStatusCell summary={studyProcessingSummaryFixtures.partialSuccess} />
      );
    });

    const statusLabel = renderer.root.findByProps({
      'data-testid': 'study-processing-status-label',
    });
    const attention = renderer.root.findByProps({
      'data-testid': 'study-processing-attention',
    });

    expect(statusLabel.children).toContain('Partial success');
    expect(attention.props['aria-label']).toBe('Processing requires attention');

    act(() => {
      renderer.unmount();
    });
  });
});
