import { shouldApplyStudyProcessingSummary } from './reducer';
import type { StudyProcessingSummary } from './types';

export type StudyProcessingNotificationKind = 'terminal' | 'attention';

export interface StudyProcessingNotificationTransition {
  deduplicationKey: string;
  kind: StudyProcessingNotificationKind;
  summary: StudyProcessingSummary;
}

function notificationDeduplicationKey(
  summary: StudyProcessingSummary,
  kind: StudyProcessingNotificationKind
): string | null {
  if (summary.runId === null || summary.version === null) {
    return null;
  }

  return [summary.studyInstanceUID, summary.runId, summary.version, kind].join(':');
}

export function deriveLiveStudyProcessingNotificationTransitions(
  previous: StudyProcessingSummary | undefined,
  incoming: StudyProcessingSummary
): StudyProcessingNotificationTransition[] {
  if (!shouldApplyStudyProcessingSummary(previous, incoming)) {
    return [];
  }

  const sameRun = previous?.runId !== null && previous?.runId === incoming.runId;
  const transitions: StudyProcessingNotificationTransition[] = [];

  if (incoming.phase === 'TERMINAL' && !(sameRun && previous?.phase === 'TERMINAL')) {
    const deduplicationKey = notificationDeduplicationKey(incoming, 'terminal');
    if (deduplicationKey) {
      transitions.push({ deduplicationKey, kind: 'terminal', summary: incoming });
    }
  }

  if (incoming.attentionRequired && !(sameRun && previous?.attentionRequired)) {
    const deduplicationKey = notificationDeduplicationKey(incoming, 'attention');
    if (deduplicationKey) {
      transitions.push({ deduplicationKey, kind: 'attention', summary: incoming });
    }
  }

  return transitions;
}
