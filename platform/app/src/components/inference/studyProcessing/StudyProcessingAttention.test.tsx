import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingSummaryFixtures } from './fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import { StudyProcessingAttention } from './StudyProcessingAttention';

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

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return <StudyProcessingAttention studyInstanceUID="visible-study" />;
}

describe('StudyProcessingAttention', () => {
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

  it('renders a separate warning banner for a study requiring attention', () => {
    act(() => {
      contextValue.receiveSnapshot([
        {
          ...studyProcessingSummaryFixtures.partialSuccess,
          studyInstanceUID: 'visible-study',
        },
      ]);
    });

    const banner = renderer.root.findByProps({
      'data-testid': 'study-processing-attention-banner',
    });

    expect(banner.props['aria-label']).toBe('Processing requires attention. 1 processing warning');
  });

  it('does not render a warning banner for a study without attention', () => {
    act(() => {
      contextValue.receiveSnapshot([
        {
          ...studyProcessingSummaryFixtures.success,
          studyInstanceUID: 'visible-study',
        },
      ]);
    });

    expect(
      renderer.root.findAllByProps({
        'data-testid': 'study-processing-attention-banner',
      })
    ).toHaveLength(0);
  });
});
