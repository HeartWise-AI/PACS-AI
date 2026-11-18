import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { studyProcessingSummaryFixtures } from '@pacs-ai/extension-core/src/studyProcessing/fixtures';
import { getStudyReprocessErrorPresentation, StudyReprocessAction } from './StudyReprocessAction';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from '@pacs-ai/extension-core/src/studyProcessing/StudyProcessingProvider';
import type { CreatedStudyProcessingRun } from '@pacs-ai/extension-core/src/studyProcessing/types';
import { StudyReprocessError } from '@pacs-ai/extension-core/src/studyProcessing/reprocessTransport';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const studyInstanceUID = '1.2.3';
const createdRun: CreatedStudyProcessingRun = {
  id: 'run-2',
  runNumber: 2,
  trigger: 'MANUAL_REPROCESS',
  phase: 'QUEUED',
  expectedModels: 3,
};

let contextValue: StudyProcessingContextValue;
let container: HTMLElement;

function ContextConsumer() {
  contextValue = useStudyProcessing();
  return null;
}

function renderAction({
  authorized = true,
  disabled = false,
  reprocessStudy = jest.fn().mockResolvedValue(createdRun),
}: {
  authorized?: boolean;
  disabled?: boolean;
  reprocessStudy?: jest.Mock;
} = {}) {
  ({ container } = render(
    <StudyProcessingProvider reprocessTransport={{ reprocessStudy }}>
      <ContextConsumer />
      <StudyReprocessAction
        studyInstanceUID={studyInstanceUID}
        authorized={authorized}
        disabled={disabled}
      />
    </StudyProcessingProvider>
  ));
  return reprocessStudy;
}

describe('StudyReprocessAction', () => {
  it('is not rendered for an unauthorized user', () => {
    renderAction({ authorized: false });

    expect(screen.queryAllByTestId('study-processing-reprocess-action')).toHaveLength(0);
  });

  it('requires explicit confirmation describing a new full run', async () => {
    const reprocessStudy = renderAction();
    const action = screen.getByTestId('study-processing-reprocess-action');

    fireEvent.click(action);
    const dialogs = container.querySelectorAll('[role="dialog"]');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].getAttribute('aria-modal')).toBe('true');
    expect(reprocessStudy).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('study-processing-reprocess-confirm'));
      await Promise.resolve();
    });

    expect(reprocessStudy).toHaveBeenCalledTimes(1);
    expect(reprocessStudy).toHaveBeenCalledWith(studyInstanceUID);
  });

  it('cancels confirmation without submitting', () => {
    const reprocessStudy = renderAction();
    fireEvent.click(screen.getByTestId('study-processing-reprocess-action'));
    fireEvent.click(screen.getByTestId('study-processing-reprocess-cancel'));

    expect(reprocessStudy).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it('disables every submission control while the request is pending', async () => {
    let resolveRequest!: (run: CreatedStudyProcessingRun) => void;
    renderAction({
      reprocessStudy: jest.fn(
        () =>
          new Promise<CreatedStudyProcessingRun>(resolve => {
            resolveRequest = resolve;
          })
      ),
    });
    fireEvent.click(screen.getByTestId('study-processing-reprocess-action'));
    fireEvent.click(screen.getByTestId('study-processing-reprocess-confirm'));

    expect(
      (screen.getByTestId('study-processing-reprocess-action') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByTestId('study-processing-reprocess-confirm') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      (screen.getByTestId('study-processing-reprocess-cancel') as HTMLButtonElement).disabled
    ).toBe(true);

    await act(async () => {
      resolveRequest(createdRun);
      await Promise.resolve();
    });
  });

  it('is disabled when the study already has an active run', () => {
    renderAction();
    act(() => {
      contextValue.receiveSnapshot([
        {
          ...studyProcessingSummaryFixtures.processing,
          studyInstanceUID,
        },
      ]);
    });

    expect(
      (screen.getByTestId('study-processing-reprocess-action') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('can be disabled explicitly for fixture mode', () => {
    renderAction({ disabled: true });

    expect(
      (screen.getByTestId('study-processing-reprocess-action') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  test.each([
    [400, 'ProcessingReprocessError400'],
    [401, 'ProcessingReprocessError401'],
    [403, 'ProcessingReprocessError403'],
    [404, 'ProcessingReprocessError404'],
    [409, 'ProcessingReprocessError409'],
    [500, 'ProcessingReprocessError500'],
    [503, 'ProcessingReprocessError503'],
    [null, 'ProcessingReprocessErrorUnavailable'],
  ])('selects safe translated feedback for status %s', (status, key) => {
    expect(
      getStudyReprocessErrorPresentation(new StudyReprocessError('private detail', status)).key
    ).toBe(key);
  });

  it('renders the created run acknowledgement after success', async () => {
    renderAction();
    fireEvent.click(screen.getByTestId('study-processing-reprocess-action'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('study-processing-reprocess-confirm'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('study-processing-reprocess-success')).toBeDefined();
  });

  it('renders safe error feedback without discarding the action', async () => {
    renderAction({
      reprocessStudy: jest.fn().mockRejectedValue(new StudyReprocessError('private detail', 500)),
    });
    fireEvent.click(screen.getByTestId('study-processing-reprocess-action'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('study-processing-reprocess-confirm'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('study-processing-reprocess-error')).toBeDefined();
    expect(screen.getByTestId('study-processing-reprocess-action')).toBeDefined();
  });
});
