import {
  isAutomaticProcessingTrigger,
  shouldRaiseCandidatePollNotification,
  shouldRaiseStudyProcessingNotification,
  type NotificationAudienceViewer,
} from './notificationAudience';
import { studyProcessingSummaryFixtures } from './studyProcessing/fixtures';
import type { StudyProcessingNotificationTransition } from './studyProcessing/notificationTransitions';
import type { StudyProcessingSummary } from './studyProcessing/types';

const admin: NotificationAudienceViewer = { isAdmin: true, notifyAutomaticRuns: true };
const member: NotificationAudienceViewer = { isAdmin: false, notifyAutomaticRuns: true };
const muted = (viewer: NotificationAudienceViewer) => ({ ...viewer, notifyAutomaticRuns: false });

function transition(
  kind: 'terminal' | 'attention',
  summary: Partial<StudyProcessingSummary>
): StudyProcessingNotificationTransition {
  return {
    deduplicationKey: `key:${kind}`,
    kind,
    summary: { ...studyProcessingSummaryFixtures.success, ...summary },
  };
}

describe('notification audience', () => {
  test('automatic triggers', () => {
    expect(isAutomaticProcessingTrigger('AUTO')).toBe(true);
    expect(isAutomaticProcessingTrigger('LEGACY_IMPORT')).toBe(true);
    expect(isAutomaticProcessingTrigger('MANUAL_REPROCESS')).toBe(false);
    expect(isAutomaticProcessingTrigger('VIEWER_REQUEST')).toBe(false);
    expect(isAutomaticProcessingTrigger(null)).toBe(false);
  });

  test.each([
    // [description, viewer, transition, expected]
    [
      'admin, automatic terminal',
      admin,
      transition('terminal', { trigger: 'AUTO', notify: true }),
      true,
    ],
    [
      'admin, automatic attention',
      admin,
      transition('attention', { trigger: 'AUTO', notify: true }),
      true,
    ],
    [
      'job owner (USER), automatic attention',
      member,
      transition('attention', { trigger: 'AUTO', notify: true }),
      true,
    ],
    [
      'not in the audience',
      member,
      transition('terminal', { trigger: 'AUTO', notify: false }),
      false,
    ],
    [
      'admin, every job silenced',
      admin,
      transition('terminal', { trigger: 'AUTO', notify: false }),
      false,
    ],
    [
      'admin who muted automatic runs',
      muted(admin),
      transition('terminal', { trigger: 'AUTO', notify: true }),
      false,
    ],
    [
      'muted, legacy import',
      muted(member),
      transition('terminal', { trigger: 'LEGACY_IMPORT', notify: true }),
      false,
    ],
    [
      'older gateway (no notify), admin',
      admin,
      transition('terminal', { trigger: 'AUTO', notify: undefined }),
      true,
    ],
    [
      'USER, own run, terminal',
      member,
      transition('terminal', { trigger: 'VIEWER_REQUEST', notify: true }),
      true,
    ],
    [
      'USER, own run, failed',
      member,
      transition('terminal', { trigger: 'MANUAL_REPROCESS', outcome: 'FAILED', notify: true }),
      true,
    ],
    [
      'USER, own run, needs attention',
      member,
      transition('attention', {
        trigger: 'MANUAL_REPROCESS',
        phase: 'PROCESSING',
        outcome: null,
        notify: true,
      }),
      false,
    ],
    [
      'USER, own run, cancelled by someone else',
      member,
      transition('terminal', {
        trigger: 'VIEWER_REQUEST',
        outcome: 'CANCELLED',
        notify: true,
        cancelledByYou: false,
      }),
      true,
    ],
    [
      'USER, own run, cancelled by self',
      member,
      transition('terminal', {
        trigger: 'VIEWER_REQUEST',
        outcome: 'CANCELLED',
        notify: true,
        cancelledByYou: true,
      }),
      false,
    ],
    [
      'USER muted automatic, own run still notifies',
      muted(member),
      transition('terminal', { trigger: 'VIEWER_REQUEST', notify: true }),
      true,
    ],
    [
      "USER, somebody else's run",
      member,
      transition('terminal', { trigger: 'VIEWER_REQUEST', notify: false }),
      false,
    ],
    [
      'admin, own run, needs attention',
      admin,
      transition('attention', { trigger: 'MANUAL_REPROCESS', notify: true }),
      true,
    ],
    [
      'admin, own run, cancelled by self',
      admin,
      transition('terminal', {
        trigger: 'MANUAL_REPROCESS',
        outcome: 'CANCELLED',
        notify: true,
        cancelledByYou: true,
      }),
      true,
    ],
    [
      "admin, somebody else's run",
      admin,
      transition('terminal', { trigger: 'MANUAL_REPROCESS', notify: false }),
      false,
    ],
  ])('%s', (_description, viewer, incoming, expected) => {
    expect(shouldRaiseStudyProcessingNotification(incoming, viewer)).toBe(expected);
  });

  test('the candidate poll fallback respects the personal mute', () => {
    expect(shouldRaiseCandidatePollNotification(admin)).toBe(true);
    expect(shouldRaiseCandidatePollNotification(muted(admin))).toBe(false);
  });
});
