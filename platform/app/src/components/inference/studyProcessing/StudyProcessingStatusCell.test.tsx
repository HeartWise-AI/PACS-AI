import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingSummaryFixtures } from './fixtures';
import { StudyProcessingStatusCell } from './StudyProcessingStatusCell';
import { getStudyProcessingStatusPresentation } from './statusPresentation';

describe('StudyProcessingStatusCell', () => {
  test.each([
    ['waiting', 'Waiting'],
    ['retrieving', 'Retrieving'],
    ['queued', 'Queued'],
    ['processing', 'Processing'],
    ['success', 'Completed'],
    ['successWithSkips', 'Completed'],
    ['partialSuccess', 'Partial'],
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
    const progressFill = renderer.root.findByProps({
      'data-testid': 'study-processing-progress-fill',
    });

    expect(progress.props['aria-valuenow']).toBe(1);
    expect(progress.props['aria-valuemax']).toBe(3);
    expect(progressFill.props.style.width).toBe('33%');

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

    const badge = renderer.root.findByProps({
      'data-testid': 'study-processing-status-badge',
    });
    const attention = renderer.root.findByProps({
      'data-testid': 'study-processing-attention',
    });

    expect(badge.children).toContain('Partial');
    expect(attention.props['aria-label']).toBe('Processing requires attention');

    act(() => {
      renderer.unmount();
    });
  });
});
