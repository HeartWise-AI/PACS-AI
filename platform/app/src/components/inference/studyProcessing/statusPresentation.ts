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
  tone: StudyProcessingStatusTone;
}

export function getStudyProcessingStatusPresentation(
  summary: StudyProcessingSummary
): StudyProcessingStatusPresentation {
  switch (summary.lifecycle) {
    case 'WAITING':
      return { label: 'Waiting', tone: 'waiting' };
    case 'RETRIEVING':
      return { label: 'Retrieving', tone: 'retrieving' };
    case 'QUEUED':
      return { label: 'Queued', tone: 'queued' };
    case 'PROCESSING':
      return { label: 'Processing', tone: 'processing' };
    case 'TERMINAL':
      break;
  }

  switch (summary.outcome) {
    case 'SUCCESS':
    case 'SUCCESS_WITH_SKIPS':
      return { label: 'Completed', tone: 'completed' };
    case 'PARTIAL_SUCCESS':
      return { label: 'Partial', tone: 'partial' };
    case 'NO_RESULT':
      return { label: 'No result', tone: 'partial' };
    case 'FAILED':
      return { label: 'Failed', tone: 'failed' };
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'cancelled' };
    default:
      return { label: 'Completed', tone: 'completed' };
  }
}

export function getStudyProcessingProgress(summary: StudyProcessingSummary): number {
  if (summary.expectedModels <= 0) {
    return 0;
  }

  const completedModels = Math.min(Math.max(summary.completedModels, 0), summary.expectedModels);

  return Math.round((completedModels / summary.expectedModels) * 100);
}
