import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingSummaryFixtures } from './fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import { StudyProcessingStatus } from './StudyProcessingStatus';

jest.mock('@ohif/ui-next', () => ({
  Icons: { StatusWarning: 'span' },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? key),
  }),
}));

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return <StudyProcessingStatus studyInstanceUID="visible-study" />;
}

describe('StudyProcessingStatus', () => {
  beforeEach(() => {
    act(() => {
      renderer = TestRenderer.create(
        <StudyProcessingProvider>
          <ContextConsumer />
        </StudyProcessingProvider>
      );
    });
  });

  afterEach(() => {
    act(() => {
      renderer.unmount();
    });
  });

  it('shows a loading skeleton before the initial snapshot is ready', () => {
    expect(
      renderer.root.findByProps({ 'data-testid': 'study-processing-loading' }).props['aria-label']
    ).toBe('Loading processing status');
  });

  it('shows no status when the snapshot has no matching study', () => {
    act(() => {
      contextValue.receiveSnapshot([]);
    });

    expect(
      renderer.root.findByProps({ 'data-testid': 'study-processing-empty' }).props['aria-label']
    ).toBe('No processing status yet');
  });

  it('shows unavailable when the initial snapshot fails', () => {
    act(() => {
      contextValue.failInitialSnapshot('Status service could not be reached.');
    });

    const unavailable = renderer.root.findByProps({
      'data-testid': 'study-processing-unavailable',
    });

    expect(unavailable.props['aria-label']).toBe('Processing status unavailable');
    expect(unavailable.props.title).toBe('Status service could not be reached.');
  });

  it('renders a matching summary even when snapshot health later fails', () => {
    act(() => {
      contextValue.receiveSnapshot([
        {
          ...studyProcessingSummaryFixtures.processing,
          studyInstanceUID: 'visible-study',
        },
      ]);
      contextValue.failInitialSnapshot('Refresh failed.');
    });

    expect(
      renderer.root.findByProps({ 'data-testid': 'study-processing-status-cell' })
    ).toBeDefined();
  });
});
