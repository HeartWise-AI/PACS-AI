import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyProcessingRunHistoryTransport } from './runHistoryTransport';
import { useStudyProcessing } from './StudyProcessingProvider';

export interface StudyReprocessActionProps {
  studyInstanceUID: string;
  authorized: boolean;
  disabled?: boolean;
  refreshVisibleStudySnapshot?: () => Promise<void> | void;
  runHistoryTransport?: StudyProcessingRunHistoryTransport;
}

export function StudyReprocessAction({
  studyInstanceUID,
  authorized,
  disabled = false,
  refreshVisibleStudySnapshot,
  runHistoryTransport,
}: StudyReprocessActionProps) {
  const { t } = useTranslation('StudyList');
  const {
    dismissStudyReprocessResult,
    getStudyReprocessRequestEntry,
    getStudySummary,
    reprocessStudy,
  } = useStudyProcessing();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const summary = getStudySummary(studyInstanceUID);
  const requestEntry = getStudyReprocessRequestEntry(studyInstanceUID);
  const activeRun = summary?.phase === 'QUEUED' || summary?.phase === 'PROCESSING';
  const submitting = requestEntry.status === 'submitting';

  if (!authorized) {
    return null;
  }

  const actionDisabled = disabled || activeRun || submitting;
  const openConfirmation = () => {
    dismissStudyReprocessResult(studyInstanceUID);
    setConfirmationOpen(true);
  };
  const confirmReprocess = () => {
    void reprocessStudy(studyInstanceUID, refreshVisibleStudySnapshot, runHistoryTransport)
      .catch(() => {
        // The request state owns safe operator feedback; the dialog can close in either outcome.
      })
      .finally(() => setConfirmationOpen(false));
  };

  return (
    <>
      <button
        type="button"
        className="border-primary-main text-primary-main disabled:border-white/15 disabled:text-white/35 ml-4 rounded-md border px-3 py-1 text-xs font-semibold hover:bg-[#c8f469]/10 disabled:cursor-not-allowed"
        onClick={openConfirmation}
        disabled={actionDisabled}
        aria-label={t('ProcessingReprocessStudyAriaLabel', {
          defaultValue: 'Reprocess this study',
        })}
        title={
          activeRun
            ? t('ProcessingReprocessActiveRun', {
                defaultValue: 'This study already has an active processing run.',
              })
            : undefined
        }
        data-testid="study-processing-reprocess-action"
      >
        {submitting
          ? t('ProcessingReprocessSubmitting', { defaultValue: 'Starting…' })
          : t('ProcessingReprocessStudy', { defaultValue: 'Reprocess study' })}
      </button>

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
            aria-labelledby="study-reprocess-confirmation-title"
            aria-describedby="study-reprocess-confirmation-description"
            className="border-white/15 w-full max-w-lg rounded-lg border bg-[#252925] p-6 text-white shadow-2xl"
          >
            <h2
              id="study-reprocess-confirmation-title"
              className="text-lg font-bold"
            >
              {t('ProcessingReprocessConfirmTitle', { defaultValue: 'Reprocess this study?' })}
            </h2>
            <p
              id="study-reprocess-confirmation-description"
              className="mt-3 text-sm leading-6 text-[#c5cbc5]"
            >
              {t('ProcessingReprocessConfirmDescription', {
                defaultValue:
                  'This creates a new full processing run for every expected model. Existing run history will be preserved.',
              })}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
                onClick={() => setConfirmationOpen(false)}
                disabled={submitting}
                data-testid="study-processing-reprocess-cancel"
              >
                {t('Cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                type="button"
                className="bg-primary-main rounded-md px-4 py-2 text-sm font-bold text-black hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
                onClick={confirmReprocess}
                disabled={submitting}
                data-testid="study-processing-reprocess-confirm"
              >
                {submitting
                  ? t('ProcessingReprocessSubmitting', { defaultValue: 'Starting…' })
                  : t('ProcessingReprocessConfirm', { defaultValue: 'Start new full run' })}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default StudyReprocessAction;
