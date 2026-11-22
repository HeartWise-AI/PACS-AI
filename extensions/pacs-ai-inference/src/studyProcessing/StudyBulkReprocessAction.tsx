import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyProcessingRunHistoryTransport } from '@pacs-ai/extension-core/src/studyProcessing/runHistoryTransport';
import { useStudyProcessing } from '@pacs-ai/extension-core/src/studyProcessing/StudyProcessingProvider';
import type { BulkStudyReprocessResponse } from '@pacs-ai/extension-core/src/studyProcessing/types';

export interface StudyBulkReprocessActionProps {
  selectedStudyInstanceUIDs: string[];
  onSelectionChange: (studyInstanceUIDs: string[]) => void;
  refreshVisibleStudySnapshot?: () => Promise<void> | void;
  runHistoryTransport?: StudyProcessingRunHistoryTransport;
}

export function StudyBulkReprocessAction({
  selectedStudyInstanceUIDs,
  onSelectionChange,
  refreshVisibleStudySnapshot,
  runHistoryTransport,
}: StudyBulkReprocessActionProps) {
  const { t } = useTranslation('StudyList');
  const { reprocessStudies } = useStudyProcessing();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<BulkStudyReprocessResponse | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const count = selectedStudyInstanceUIDs.length;

  const confirmReprocess = () => {
    setSubmitting(true);
    setRequestFailed(false);
    setLastResponse(null);
    void reprocessStudies(
        selectedStudyInstanceUIDs,
        refreshVisibleStudySnapshot,
        runHistoryTransport
      )
      .then(response => {
        setLastResponse(response);
        onSelectionChange(
          response.results
            .filter(result => !result.accepted)
            .map(result => result.studyInstanceUID)
        );
      })
      .catch(() => setRequestFailed(true))
      .finally(() => {
        setConfirmationOpen(false);
        setSubmitting(false);
      });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="bg-primary rounded-md px-4 py-2 text-sm font-bold text-black hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={count === 0 || submitting}
        onClick={() => {
          setLastResponse(null);
          setRequestFailed(false);
          setConfirmationOpen(true);
        }}
        data-testid="study-bulk-reprocess-action"
      >
        {submitting
          ? t('ProcessingBulkReprocessSubmitting', { defaultValue: 'Queueing…' })
          : t('ProcessingBulkReprocessSelected', {
              count,
              defaultValue: 'Reprocess selected ({{count}})',
            })}
      </button>

      {count > 0 && (
        <button
          type="button"
          className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10 disabled:opacity-40"
          disabled={submitting}
          onClick={() => onSelectionChange([])}
        >
          {t('ProcessingBulkClearSelection', { defaultValue: 'Clear selection' })}
        </button>
      )}

      {lastResponse && (
        <span
          role="status"
          className={lastResponse.rejectedCount > 0 ? 'text-sm text-[#ffcf7d]' : 'text-sm text-[#5bea8f]'}
          data-testid="study-bulk-reprocess-result"
        >
          {t('ProcessingBulkReprocessResult', {
            acceptedCount: lastResponse.acceptedCount,
            rejectedCount: lastResponse.rejectedCount,
            defaultValue:
              '{{acceptedCount}} queued; {{rejectedCount}} could not be queued. Failed studies remain selected.',
          })}
        </span>
      )}

      {requestFailed && (
        <span
          role="alert"
          className="text-sm font-semibold text-[#ff9b9b]"
        >
          {t('ProcessingBulkReprocessRequestFailed', {
            defaultValue: 'The selected studies could not be submitted. Please try again.',
          })}
        </span>
      )}

      {confirmationOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !submitting) {
              setConfirmationOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-study-reprocess-confirmation-title"
            aria-describedby="bulk-study-reprocess-confirmation-description"
            className="border-white/15 w-full max-w-lg rounded-lg border bg-[#252925] p-6 text-white shadow-2xl"
          >
            <h2
              id="bulk-study-reprocess-confirmation-title"
              className="text-lg font-bold"
            >
              {t('ProcessingBulkReprocessConfirmTitle', {
                count,
                defaultValue: 'Reprocess {{count}} selected studies?',
              })}
            </h2>
            <p
              id="bulk-study-reprocess-confirmation-description"
              className="mt-3 text-sm leading-6 text-[#c5cbc5]"
            >
              {t('ProcessingBulkReprocessConfirmDescription', {
                count,
                defaultValue:
                  'This queues {{count}} new full processing runs, one for each selected study. Existing run history is preserved.',
              })}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
                onClick={() => setConfirmationOpen(false)}
                disabled={submitting}
                data-testid="study-bulk-reprocess-cancel"
              >
                {t('Cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                className="bg-primary rounded-md px-4 py-2 text-sm font-bold text-black hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
                onClick={confirmReprocess}
                disabled={submitting}
                data-testid="study-bulk-reprocess-confirm"
              >
                {submitting
                  ? t('ProcessingBulkReprocessSubmitting', { defaultValue: 'Queueing…' })
                  : t('ProcessingBulkReprocessConfirm', {
                      count,
                      defaultValue: 'Queue {{count}} full runs',
                    })}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default StudyBulkReprocessAction;
