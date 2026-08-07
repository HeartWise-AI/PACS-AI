import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudyProcessingRunHistoryTransport } from './runHistoryTransport';
import { StudyReprocessError } from './reprocessTransport';
import { useStudyProcessing } from './StudyProcessingProvider';

export interface StudyReprocessActionProps {
  studyInstanceUID: string;
  authorized: boolean;
  disabled?: boolean;
  refreshVisibleStudySnapshot?: () => Promise<void> | void;
  runHistoryTransport?: StudyProcessingRunHistoryTransport;
}

export function getStudyReprocessErrorPresentation(error: Error | null): {
  key: string;
  defaultValue: string;
} {
  const status = error instanceof StudyReprocessError ? error.status : null;
  const presentationByStatus: Record<number, { key: string; defaultValue: string }> = {
    400: {
      key: 'ProcessingReprocessError400',
      defaultValue: 'The Study Instance UID is invalid.',
    },
    401: {
      key: 'ProcessingReprocessError401',
      defaultValue: 'Please sign in again before reprocessing this study.',
    },
    403: {
      key: 'ProcessingReprocessError403',
      defaultValue: 'You do not have permission to reprocess this study.',
    },
    404: {
      key: 'ProcessingReprocessError404',
      defaultValue: 'No processing candidates were found for this study.',
    },
    409: {
      key: 'ProcessingReprocessError409',
      defaultValue: 'This study already has an active processing run. Its status was refreshed.',
    },
    500: {
      key: 'ProcessingReprocessError500',
      defaultValue: 'The processing service could not create a new run.',
    },
    503: {
      key: 'ProcessingReprocessError503',
      defaultValue: 'The processing service is temporarily unavailable.',
    },
  };

  return (
    (status && presentationByStatus[status]) || {
      key: 'ProcessingReprocessErrorUnavailable',
      defaultValue: 'Unable to reprocess this study. Please try again.',
    }
  );
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
  const errorPresentation = getStudyReprocessErrorPresentation(requestEntry.error);

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
    <div className="ml-4 flex items-center gap-2">
      <button
        type="button"
        className="border-primary-main text-primary-main disabled:border-white/15 disabled:text-white/35 rounded-md border px-3 py-1 text-xs font-semibold hover:bg-[#c8f469]/10 disabled:cursor-not-allowed"
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

      {requestEntry.status === 'success' && requestEntry.createdRun && (
        <span
          className="text-xs font-semibold text-[#5bea8f]"
          role="status"
          data-testid="study-processing-reprocess-success"
        >
          {t('ProcessingReprocessSuccess', {
            runNumber: requestEntry.createdRun.runNumber,
            defaultValue: 'Run #{{runNumber}} was created.',
          })}
        </span>
      )}

      {requestEntry.status === 'error' && (
        <span
          className="max-w-sm text-xs font-semibold text-[#ff9b9b]"
          role="alert"
          data-testid="study-processing-reprocess-error"
        >
          {t(errorPresentation.key, { defaultValue: errorPresentation.defaultValue })}
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
    </div>
  );
}

export default StudyReprocessAction;
