import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { studyProcessingSummaryFixtures } from './fixtures';
import { StudyReprocessAction } from './StudyReprocessAction';
import {
  StudyProcessingProvider,
  useStudyProcessing,
  type StudyProcessingContextValue,
} from './StudyProcessingProvider';
import type { CreatedStudyProcessingRun } from './types';

const studyInstanceUID = '1.2.3';
const createdRun: CreatedStudyProcessingRun = {
  id: 'run-2',
  runNumber: 2,
  trigger: 'MANUAL_REPROCESS',
  phase: 'QUEUED',
  expectedModels: 3,
};

let contextValue: StudyProcessingContextValue;
let renderer: ReactTestRenderer;

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
  act(() => {
    renderer = TestRenderer.create(
      <StudyProcessingProvider reprocessTransport={{ reprocessStudy }}>
        <ContextConsumer />
        <StudyReprocessAction
          studyInstanceUID={studyInstanceUID}
          authorized={authorized}
          disabled={disabled}
        />
      </StudyProcessingProvider>
    );
  });
  return reprocessStudy;
}

describe('StudyReprocessAction', () => {
  afterEach(() => {
    act(() => renderer.unmount());
  });

  it('is not rendered for an unauthorized user', () => {
    renderAction({ authorized: false });

    expect(
      renderer.root.findAllByProps({
        'data-testid': 'study-processing-reprocess-action',
      })
    ).toHaveLength(0);
  });

  it('requires explicit confirmation describing a new full run', async () => {
    const reprocessStudy = renderAction();
    const action = renderer.root.findByProps({
      'data-testid': 'study-processing-reprocess-action',
    });

    act(() => action.props.onClick());
    const dialog = renderer.root.findByProps({ role: 'dialog' });
    expect(dialog.props['aria-modal']).toBe('true');
    expect(reprocessStudy).not.toHaveBeenCalled();

    await act(async () => {
      renderer.root
        .findByProps({
          'data-testid': 'study-processing-reprocess-confirm',
        })
        .props.onClick();
      await Promise.resolve();
    });

    expect(reprocessStudy).toHaveBeenCalledTimes(1);
    expect(reprocessStudy).toHaveBeenCalledWith(studyInstanceUID);
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
      renderer.root.findByProps({ 'data-testid': 'study-processing-reprocess-action' }).props
        .disabled
    ).toBe(true);
  });

  it('can be disabled explicitly for fixture mode', () => {
    renderAction({ disabled: true });

    expect(
      renderer.root.findByProps({ 'data-testid': 'study-processing-reprocess-action' }).props
        .disabled
    ).toBe(true);
  });
});
