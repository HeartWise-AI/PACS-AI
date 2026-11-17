import type { StudyProcessingNotificationTransition } from './studyProcessing/notificationTransitions';
import type { ProcessingRunTrigger } from './studyProcessing/types';

/** Runs started by an automatic ingestion job rather than by a person. */
export function isAutomaticProcessingTrigger(
  trigger: ProcessingRunTrigger | null | undefined
): boolean {
  return trigger === 'AUTO' || trigger === 'LEGACY_IMPORT';
}

export interface NotificationAudienceViewer {
  /** Workspace role ADMIN or OWNER. */
  isAdmin: boolean;
  /** Personal preference (user metadata notifyAutomaticRuns); true unless muted. */
  notifyAutomaticRuns: boolean;
}

export const DEFAULT_NOTIFICATION_AUDIENCE_VIEWER: NotificationAudienceViewer = {
  isAdmin: false,
  notifyAutomaticRuns: true,
};

/**
 * Whether a live processing transition raises a bell entry and a toast for
 * the signed-in user. The work-list status is applied before this is asked
 * and never depends on it.
 *
 * - The gateway decides the audience (`notify`): automatic runs reach the
 *   creators of their ingestion jobs and workspace admins, other runs only the
 *   user who launched them.
 * - The personal mute of automatic runs applies at once, before the gateway
 *   picks it up on the next stream reconnect.
 * - Admins and job owners keep every automatic-run transition.
 * - A role-USER member hears about their own runs only at the end: the
 *   terminal outcome, not intermediate "needs attention" changes (a failed run
 *   is reported by its terminal transition), and not a cancellation they made.
 */
export function shouldRaiseStudyProcessingNotification(
  transition: StudyProcessingNotificationTransition,
  viewer: NotificationAudienceViewer
): boolean {
  const { kind, summary } = transition;
  if (summary.notify === false) {
    return false;
  }
  if (isAutomaticProcessingTrigger(summary.trigger)) {
    return viewer.notifyAutomaticRuns;
  }
  if (viewer.isAdmin) {
    return true;
  }
  if (kind !== 'terminal') {
    return false;
  }
  return !(summary.outcome === 'CANCELLED' && summary.cancelledByYou === true);
}

/**
 * The admin-only candidate poll fallback only sees automatic ingestion, so
 * only the personal mute applies to it.
 */
export function shouldRaiseCandidatePollNotification(viewer: NotificationAudienceViewer): boolean {
  return viewer.notifyAutomaticRuns;
}
