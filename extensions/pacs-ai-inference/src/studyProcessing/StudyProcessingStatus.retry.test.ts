import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from '@pacs-ai/extension-core/src/studyProcessing/StudyProcessingProvider';
import { StudyProcessingStatus } from './StudyProcessingStatus';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, unknown> = {}) => String(options.defaultValue ?? key),
  }),
}));

jest.mock('./StudyProcessingStatusCell', () => ({
  StudyProcessingStatusCell: () => null,
}));

let contextValue: StudyProcessingContextValue;

function Consumer({ onRetry }: { onRetry: () => void }) {
  contextValue = useStudyProcessing();
  return React.createElement(StudyProcessingStatus, {
    studyInstanceUID: 'visible-study',
    onRetry,
  });
}

describe('StudyProcessingStatus retry', () => {
  test('offers retry without expanding the worklist row', () => {
    const onRetry = jest.fn();
    render(
      React.createElement(StudyProcessingProvider, null, React.createElement(Consumer, { onRetry }))
    );
    act(() => contextValue.failInitialSnapshot('Service unavailable.'));

    const retryButton = screen.getByTestId('study-processing-status-retry');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopPropagation = jest.spyOn(clickEvent, 'stopPropagation');
    fireEvent(retryButton, clickEvent);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(retryButton.getAttribute('aria-label')).toBe('Retry processing status');
  });

  test('does not offer retry for an authentication or permission failure', () => {
    const onRetry = jest.fn();
    render(
      React.createElement(StudyProcessingProvider, null, React.createElement(Consumer, { onRetry }))
    );
    act(() => contextValue.failInitialSnapshot('Authorization failed.', false));

    expect(screen.queryAllByTestId('study-processing-status-retry')).toHaveLength(0);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
