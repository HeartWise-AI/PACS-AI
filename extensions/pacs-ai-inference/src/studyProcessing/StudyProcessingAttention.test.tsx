import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { studyProcessingSummaryFixtures } from '@pacs-ai/extension-core/src/studyProcessing/fixtures';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from '@pacs-ai/extension-core/src/studyProcessing/StudyProcessingProvider';
import { StudyProcessingAttention } from './StudyProcessingAttention';

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

let contextValue: StudyProcessingContextValue;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return <StudyProcessingAttention studyInstanceUID="visible-study" />;
}

describe('StudyProcessingAttention', () => {
  beforeEach(() => {
    render(
      <StudyProcessingProvider>
        <ContextConsumer />
      </StudyProcessingProvider>
    );
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

    const banner = screen.getByTestId('study-processing-attention-banner');

    expect(banner.getAttribute('aria-label')).toBe(
      'Processing requires attention. 1 processing warning'
    );
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

    expect(screen.queryAllByTestId('study-processing-attention-banner')).toHaveLength(0);
  });
});
