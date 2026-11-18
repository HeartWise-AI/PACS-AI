import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { studyProcessingSummaryFixtures } from '@pacs-ai/extension-core/src/studyProcessing/fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from '@pacs-ai/extension-core/src/studyProcessing/StudyProcessingProvider';
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

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return <StudyProcessingStatus studyInstanceUID="visible-study" />;
}

describe('StudyProcessingStatus', () => {
  beforeEach(() => {
    render(
      <StudyProcessingProvider>
        <ContextConsumer />
      </StudyProcessingProvider>
    );
  });

  it('shows a loading skeleton before the initial snapshot is ready', () => {
    expect(screen.getByTestId('study-processing-loading').getAttribute('aria-label')).toBe(
      'Loading processing status'
    );
  });

  it('shows no status when the snapshot has no matching study', () => {
    act(() => {
      contextValue.receiveSnapshot([]);
    });

    expect(screen.getByTestId('study-processing-empty').getAttribute('aria-label')).toBe(
      'No processing status yet'
    );
  });

  it('shows unavailable when the initial snapshot fails', () => {
    act(() => {
      contextValue.failInitialSnapshot('Status service could not be reached.');
    });

    const unavailable = screen.getByTestId('study-processing-unavailable');

    expect(unavailable.getAttribute('aria-label')).toBe('Processing status unavailable');
    expect(unavailable.getAttribute('title')).toBe('Status service could not be reached.');
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

    expect(screen.getByTestId('study-processing-status-cell')).toBeDefined();
  });
});
