import type { ProcessingTransitionEvent } from '../../hooks/useCandidateProcessingPoll';
import type {
  StudyProcessingNotificationKind,
  StudyProcessingNotificationTransition,
} from './studyProcessing/notificationTransitions';
import type { ProcessingAttentionReason, ProcessingRunOutcome } from './studyProcessing/types';
import type { ResolvedStudyNotificationMetadata } from './studyNotificationMetadata';

export interface StudyNotificationWorklistMetadata {
  patientName: string | null;
  modalitiesInStudy: string | null;
  studyInstanceUID: string;
}

export interface InferenceNotification {
  // Only known once the study was looked up on the server.
  accessionNumber?: string | null;
  attentionReasons: ProcessingAttentionReason[];
  deduplicationKey: string;
  kind: StudyProcessingNotificationKind;
  modalitiesInStudy: string | null;
  occurredAt: string;
  outcome: ProcessingRunOutcome | null;
  patientId?: string | null;
  patientName: string | null;
  read: boolean;
  runId: string | null;
  runNumber: number | null;
  seenAt: number;
  source: 'study-event' | 'candidate-poll';
  studyInstanceUID: string;
  version: number | null;
}

export interface InferenceNotificationPresentation {
  labelKey: string;
  titleKey: string;
  tone: 'error' | 'info' | 'success';
}

const OUTCOME_PRESENTATION: Record<ProcessingRunOutcome, InferenceNotificationPresentation> = {
  SUCCESS: {
    labelKey: 'ProcessingStatusSuccess',
    titleKey: 'ProcessingNotificationTitle.SUCCESS',
    tone: 'success',
  },
  SUCCESS_WITH_SKIPS: {
    labelKey: 'ProcessingStatusSuccessWithSkips',
    titleKey: 'ProcessingNotificationTitle.SUCCESS_WITH_SKIPS',
    tone: 'success',
  },
  PARTIAL_SUCCESS: {
    labelKey: 'ProcessingStatusPartialSuccess',
    titleKey: 'ProcessingNotificationTitle.PARTIAL_SUCCESS',
    tone: 'info',
  },
  NO_RESULT: {
    labelKey: 'ProcessingStatusNoResult',
    titleKey: 'ProcessingNotificationTitle.NO_RESULT',
    tone: 'info',
  },
  FAILED: {
    labelKey: 'ProcessingStatusFailed',
    titleKey: 'ProcessingNotificationTitle.FAILED',
    tone: 'error',
  },
  CANCELLED: {
    labelKey: 'ProcessingStatusCancelled',
    titleKey: 'ProcessingNotificationTitle.CANCELLED',
    tone: 'info',
  },
};

export function createStudyEventInferenceNotification(
  transition: StudyProcessingNotificationTransition,
  metadata: StudyNotificationWorklistMetadata | undefined,
  seenAt: number,
  read: boolean
): InferenceNotification {
  const { summary } = transition;

  return {
    attentionReasons: summary.attentionReasons,
    deduplicationKey: transition.deduplicationKey,
    kind: transition.kind,
    modalitiesInStudy: metadata?.modalitiesInStudy ?? null,
    occurredAt: summary.updatedAt,
    outcome: summary.outcome,
    patientName: metadata?.patientName ?? null,
    read,
    runId: summary.runId,
    runNumber: summary.runNumber,
    seenAt,
    source: 'study-event',
    studyInstanceUID: summary.studyInstanceUID,
    version: summary.version,
  };
}

function candidateOutcome(event: ProcessingTransitionEvent): ProcessingRunOutcome {
  switch (event.processingStatus) {
    case 'completed':
      return 'SUCCESS';
    case 'partial':
      return 'PARTIAL_SUCCESS';
    case 'failed':
      return 'FAILED';
  }
}

export function createCandidatePollInferenceNotification(
  event: ProcessingTransitionEvent,
  seenAt: number,
  read: boolean
): InferenceNotification {
  const occurredAt = new Date(event.processingStatusAt * 1000);

  return {
    attentionReasons: [],
    deduplicationKey: `candidate:${event.candidateId}:${event.processingStatusAt}`,
    kind: 'terminal',
    modalitiesInStudy: event.modalitiesInStudy || null,
    occurredAt: Number.isNaN(occurredAt.getTime())
      ? new Date(seenAt).toISOString()
      : occurredAt.toISOString(),
    outcome: candidateOutcome(event),
    patientName: event.patientId || null,
    read,
    runId: null,
    runNumber: null,
    seenAt,
    source: 'candidate-poll',
    studyInstanceUID: event.studyInstanceUID,
    version: null,
  };
}

export function addRecentInferenceNotification(
  notifications: InferenceNotification[],
  incoming: InferenceNotification,
  recentLimit: number
): InferenceNotification[] {
  if (
    notifications.some(notification => notification.deduplicationKey === incoming.deduplicationKey)
  ) {
    return notifications;
  }

  return [incoming, ...notifications].slice(0, recentLimit);
}

export function markAllInferenceNotificationsRead(
  notifications: InferenceNotification[]
): InferenceNotification[] {
  return notifications.map(notification =>
    notification.read ? notification : { ...notification, read: true }
  );
}

export function getInferenceNotificationPresentation(
  notification: InferenceNotification
): InferenceNotificationPresentation {
  if (notification.kind === 'attention') {
    return {
      labelKey: 'ProcessingRequiresAttention',
      titleKey: 'ProcessingNotificationTitle.ATTENTION',
      tone: 'info',
    };
  }

  return notification.outcome
    ? OUTCOME_PRESENTATION[notification.outcome]
    : {
        labelKey: 'ProcessingStatusFinished',
        titleKey: 'ProcessingNotificationTitle.UNKNOWN',
        tone: 'info',
      };
}

export function needsStudyNotificationMetadata(notification: InferenceNotification): boolean {
  return !notification.patientName || !notification.modalitiesInStudy;
}

/** Fills the labels a notification is missing; what it already shows is kept. */
export function mergeStudyNotificationMetadata(
  notification: InferenceNotification,
  metadata: ResolvedStudyNotificationMetadata | null | undefined
): InferenceNotification {
  if (!metadata || metadata.studyInstanceUID !== notification.studyInstanceUID) {
    return notification;
  }

  const merged: InferenceNotification = {
    ...notification,
    accessionNumber: notification.accessionNumber || metadata.accessionNumber,
    modalitiesInStudy: notification.modalitiesInStudy || metadata.modalitiesInStudy,
    patientId: notification.patientId || metadata.patientId,
    patientName: notification.patientName || metadata.patientName,
  };
  const changed =
    (merged.accessionNumber ?? null) !== (notification.accessionNumber ?? null) ||
    merged.modalitiesInStudy !== notification.modalitiesInStudy ||
    (merged.patientId ?? null) !== (notification.patientId ?? null) ||
    merged.patientName !== notification.patientName;

  return changed ? merged : notification;
}

/** Updates, in place in the list, every notification of the resolved study. */
export function applyStudyNotificationMetadata(
  notifications: InferenceNotification[],
  metadata: ResolvedStudyNotificationMetadata
): InferenceNotification[] {
  let changed = false;
  const next = notifications.map(notification => {
    const merged = mergeStudyNotificationMetadata(notification, metadata);
    changed = changed || merged !== notification;
    return merged;
  });
  return changed ? next : notifications;
}

const STUDY_UID_SUFFIX_LENGTH = 8;

export interface InferenceNotificationLabels {
  primary: string;
  secondary: string;
}

type TranslateNotificationLabel = (key: string, options?: Record<string, unknown>) => string;

/**
 * The two text lines of a notification. Without a patient the study is still
 * identified, by its accession number or else the end of its study UID.
 */
export function getInferenceNotificationLabels(
  notification: InferenceNotification,
  t: TranslateNotificationLabel
): InferenceNotificationLabels {
  const patient = notification.patientName || notification.patientId || null;
  const modalities = notification.modalitiesInStudy || null;
  const uid = notification.studyInstanceUID?.trim() ?? '';
  const reference = notification.accessionNumber
    ? t('ProcessingNotificationAccession', { accession: notification.accessionNumber })
    : uid
      ? t('ProcessingNotificationStudyReference', {
          suffix: uid.slice(-STUDY_UID_SUFFIX_LENGTH),
        })
      : null;
  // An identified patient needs no further reference when modalities are known.
  const secondaryParts = patient ? [modalities ?? reference] : [modalities, reference];

  return {
    primary: patient ?? t('ProcessingNotificationUnknownStudy'),
    secondary:
      secondaryParts.filter(Boolean).join(' · ') || t('ProcessingNotificationUnknownModality'),
  };
}
