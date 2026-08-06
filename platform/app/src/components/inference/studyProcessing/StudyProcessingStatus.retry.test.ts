import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
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
let renderer: ReactTestRenderer;

function Consumer({ onRetry }: { onRetry: () => void }) {
  contextValue = useStudyProcessing();
  return React.createElement(StudyProcessingStatus, {
    studyInstanceUID: 'visible-study',
    onRetry,
  });
}

describe('StudyProcessingStatus retry', () => {
  afterEach(() => {
    if (renderer) {
      act(() => renderer.unmount());
    }
  });

  test('offers retry without expanding the worklist row', () => {
    const onRetry = jest.fn();
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(
          StudyProcessingProvider,
          null,
          React.createElement(Consumer, { onRetry })
        )
      );
    });
    act(() => contextValue.failInitialSnapshot('Service unavailable.'));

    const retryButton = renderer.root.findByProps({
      'data-testid': 'study-processing-status-retry',
    });
    const stopPropagation = jest.fn();
    act(() => retryButton.props.onClick({ stopPropagation }));

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(retryButton.props['aria-label']).toBe('Retry processing status');
  });

  test('does not offer retry for an authentication or permission failure', () => {
    const onRetry = jest.fn();
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(
          StudyProcessingProvider,
          null,
          React.createElement(Consumer, { onRetry })
        )
      );
    });
    act(() => contextValue.failInitialSnapshot('Authorization failed.', false));

    expect(
      renderer.root.findAllByProps({
        'data-testid': 'study-processing-status-retry',
      })
    ).toHaveLength(0);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
