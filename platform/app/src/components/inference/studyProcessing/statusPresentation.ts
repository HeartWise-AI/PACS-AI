import type { StudyProcessingSummary } from './types';

export type StudyProcessingStatusTone =
  | 'waiting'
  | 'retrieving'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export interface StudyProcessingStatusPresentation {
  label: string;
  translationKey: string;
  tone: StudyProcessingStatusTone;
}

export function getStudyProcessingStatusPresentation(
  summary: StudyProcessingSummary
): StudyProcessingStatusPresentation {
  switch (summary.lifecycle) {
    case 'WAITING':
      return {
        label: 'Waiting',
        translationKey: 'ProcessingStatusWaiting',
        tone: 'waiting',
      };
    case 'RETRIEVING':
      return {
        label: 'Retrieving',
        translationKey: 'ProcessingStatusRetrieving',
        tone: 'retrieving',
      };
    case 'QUEUED':
      return {
        label: 'Queued',
        translationKey: 'ProcessingStatusQueued',
        tone: 'queued',
      };
    case 'PROCESSING':
      return {
        label: 'Processing',
        translationKey: 'ProcessingStatusProcessing',
        tone: 'processing',
      };
    case 'TERMINAL':
      break;
  }

  switch (summary.outcome) {
    case 'SUCCESS':
      return {
        label: 'Success',
        translationKey: 'ProcessingStatusSuccess',
        tone: 'completed',
      };
    case 'SUCCESS_WITH_SKIPS':
      return {
        label: 'Success with skips',
        translationKey: 'ProcessingStatusSuccessWithSkips',
        tone: 'completed',
      };
    case 'PARTIAL_SUCCESS':
      return {
        label: 'Partial success',
        translationKey: 'ProcessingStatusPartialSuccess',
        tone: 'partial',
      };
    case 'NO_RESULT':
      return {
        label: 'No result',
        translationKey: 'ProcessingStatusNoResult',
        tone: 'partial',
      };
    case 'FAILED':
      return {
        label: 'Failed',
        translationKey: 'ProcessingStatusFailed',
        tone: 'failed',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        translationKey: 'ProcessingStatusCancelled',
        tone: 'cancelled',
      };
    default:
      return {
        label: 'Finished',
        translationKey: 'ProcessingStatusFinished',
        tone: 'cancelled',
      };
  }
}
