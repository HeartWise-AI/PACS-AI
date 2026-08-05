import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingRunHistoryFixture } from './fixtures';
import { StudyProcessingProvider } from './StudyProcessingProvider';
import { StudyProcessingRunHistoryPanel } from './StudyProcessingRunHistoryPanel';
import type {
  RunHistoryTransportResponse,
  StudyProcessingRunHistoryTransport,
} from './runHistoryTransport';

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

let renderer: ReactTestRenderer | null;

function renderPanel(transport: StudyProcessingRunHistoryTransport, studyInstanceUID = 'study-a') {
  renderer = TestRenderer.create(
    <StudyProcessingProvider runHistoryTransport={transport}>
      <StudyProcessingRunHistoryPanel studyInstanceUID={studyInstanceUID} />
    </StudyProcessingProvider>
  );
}

describe('StudyProcessingRunHistoryPanel', () => {
  beforeEach(() => {
    renderer = null;
  });

  afterEach(() => {
    if (renderer) {
      act(() => {
        renderer?.unmount();
      });
    }
  });

  test('loads history only for the mounted study', async () => {
    const loadRunHistory = jest.fn(async (studyInstanceUID: string) => ({
      history: {
        ...studyProcessingRunHistoryFixture,
        studyInstanceUID,
      },
      partial: false,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, 'requested-study');
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(1);
    expect(loadRunHistory).toHaveBeenCalledWith('requested-study');
  });

  test('shows a loading state while the first request is pending', () => {
    const loadRunHistory = jest.fn(() => new Promise<RunHistoryTransportResponse>(() => undefined));

    act(() => {
      renderPanel({ loadRunHistory });
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-run-history-loading',
      })
    ).toBeDefined();
  });

  test('shows partial history without hiding the available runs', async () => {
    const loadRunHistory = jest.fn(async () => ({
      history: studyProcessingRunHistoryFixture,
      partial: true,
    }));

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    expect(
      renderer?.root.findByProps({
        'data-testid': 'study-processing-run-history-partial',
      })
    ).toBeDefined();
    expect(renderer?.root.findAllByType('article')).toHaveLength(
      studyProcessingRunHistoryFixture.runs.length
    );
  });

  test('retries a failed initial request', async () => {
    const loadRunHistory = jest
      .fn()
      .mockRejectedValueOnce(new Error('Temporary failure.'))
      .mockResolvedValueOnce({
        history: studyProcessingRunHistoryFixture,
        partial: false,
      });

    await act(async () => {
      renderPanel({ loadRunHistory }, studyProcessingRunHistoryFixture.studyInstanceUID);
    });

    const retryButton = renderer?.root.findByProps({
      'data-testid': 'study-processing-run-history-retry',
    });

    await act(async () => {
      retryButton?.props.onClick();
    });

    expect(loadRunHistory).toHaveBeenCalledTimes(2);
    expect(renderer?.root.findAllByType('article')).toHaveLength(
      studyProcessingRunHistoryFixture.runs.length
    );
  });
});
