import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StudyProcessingProvider } from '@pacs-ai/extension-core/src/studyProcessing/StudyProcessingProvider';
import type { BulkStudyReprocessResponse } from '@pacs-ai/extension-core/src/studyProcessing/types';
import { StudyBulkReprocessAction } from './StudyBulkReprocessAction';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const partialResponse: BulkStudyReprocessResponse = {
  acceptedCount: 1,
  rejectedCount: 1,
  results: [
    {
      studyInstanceUID: 'study-a',
      accepted: true,
      run: {
        id: 'run-a',
        runNumber: 2,
        trigger: 'MANUAL_REPROCESS',
        phase: 'QUEUED',
        expectedModels: 2,
      },
    },
    {
      studyInstanceUID: 'study-b',
      accepted: false,
      errorCode: 'DUPLICATE_RECORD',
      retryAfterSeconds: null,
    },
  ],
};

function renderAction({
  reprocessStudies = jest.fn().mockResolvedValue(partialResponse),
  onSelectionChange = jest.fn(),
}: {
  reprocessStudies?: jest.Mock;
  onSelectionChange?: jest.Mock;
} = {}) {
  render(
    <StudyProcessingProvider bulkReprocessTransport={{ reprocessStudies }}>
      <StudyBulkReprocessAction
        selectedStudyInstanceUIDs={['study-a', 'study-b']}
        onSelectionChange={onSelectionChange}
      />
    </StudyProcessingProvider>
  );
  return { onSelectionChange, reprocessStudies };
}

describe('StudyBulkReprocessAction', () => {
  it('requires confirmation with the selected count before queueing', async () => {
    const { reprocessStudies } = renderAction();

    fireEvent.click(screen.getByTestId('study-bulk-reprocess-action'));
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(reprocessStudies).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('study-bulk-reprocess-confirm'));
      await Promise.resolve();
    });

    expect(reprocessStudies).toHaveBeenCalledWith(['study-a', 'study-b']);
  });

  it('keeps only rejected studies selected and presents the partial result', async () => {
    const { onSelectionChange } = renderAction();
    fireEvent.click(screen.getByTestId('study-bulk-reprocess-action'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('study-bulk-reprocess-confirm'));
      await Promise.resolve();
    });

    expect(onSelectionChange).toHaveBeenCalledWith(['study-b']);
    expect(screen.getByTestId('study-bulk-reprocess-result')).toBeDefined();
  });

  it('retains the selection and shows safe feedback when the request fails', async () => {
    const onSelectionChange = jest.fn();
    renderAction({
      reprocessStudies: jest.fn().mockRejectedValue(new Error('private response detail')),
      onSelectionChange,
    });
    fireEvent.click(screen.getByTestId('study-bulk-reprocess-action'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('study-bulk-reprocess-confirm'));
      await Promise.resolve();
    });

    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(
      'ProcessingBulkReprocessRequestFailed'
    );
  });

  it('clears selection without submitting', () => {
    const { onSelectionChange, reprocessStudies } = renderAction();

    fireEvent.click(screen.getByText('ProcessingBulkClearSelection'));

    expect(onSelectionChange).toHaveBeenCalledWith([]);
    expect(reprocessStudies).not.toHaveBeenCalled();
  });
});
