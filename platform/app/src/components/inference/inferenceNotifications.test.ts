import { studyProcessingSummaryFixtures } from './studyProcessing/fixtures';
import type { StudyProcessingNotificationTransition } from './studyProcessing/notificationTransitions';
import {
  addRecentInferenceNotification,
  createCandidatePollInferenceNotification,
  createStudyEventInferenceNotification,
  getInferenceNotificationPresentation,
  markAllInferenceNotificationsRead,
} from './inferenceNotifications';

const terminalTransition: StudyProcessingNotificationTransition = {
  deduplicationKey: 'study-1:run-1:7:terminal',
  kind: 'terminal',
  summary: {
    ...studyProcessingSummaryFixtures.success,
    studyInstanceUID: 'study-1',
    runId: 'run-1',
  },
};

describe('inference notifications', () => {
  test.each([
    ['SUCCESS', 'ProcessingStatusSuccess', 'success'],
    ['SUCCESS_WITH_SKIPS', 'ProcessingStatusSuccessWithSkips', 'success'],
    ['PARTIAL_SUCCESS', 'ProcessingStatusPartialSuccess', 'info'],
    ['NO_RESULT', 'ProcessingStatusNoResult', 'info'],
    ['FAILED', 'ProcessingStatusFailed', 'error'],
    ['CANCELLED', 'ProcessingStatusCancelled', 'info'],
  ] as const)('presents the %s terminal outcome', (outcome, labelKey, tone) => {
    const notification = createStudyEventInferenceNotification(
      {
        ...terminalTransition,
        summary: { ...terminalTransition.summary, outcome },
      },
      undefined,
      1000,
      false
    );

    expect(getInferenceNotificationPresentation(notification)).toEqual(
      expect.objectContaining({ labelKey, tone })
    );
  });

  it('enriches a study event only from supplied visible-worklist metadata', () => {
    const notification = createStudyEventInferenceNotification(
      terminalTransition,
      {
        studyInstanceUID: 'study-1',
        patientName: 'Visible patient',
        modalitiesInStudy: 'XA',
      },
      1000,
      false
    );

    expect(notification).toEqual(
      expect.objectContaining({
        deduplicationKey: 'study-1:run-1:7:terminal',
        patientName: 'Visible patient',
        modalitiesInStudy: 'XA',
        source: 'study-event',
      })
    );
  });

  it('keeps safe null metadata when the event study is not visible', () => {
    const notification = createStudyEventInferenceNotification(
      terminalTransition,
      undefined,
      1000,
      false
    );

    expect(notification.patientName).toBeNull();
    expect(notification.modalitiesInStudy).toBeNull();
  });

  it('deduplicates by the complete run notification identity and stays bounded', () => {
    const first = createStudyEventInferenceNotification(terminalTransition, undefined, 1000, false);
    const second = createStudyEventInferenceNotification(
      {
        ...terminalTransition,
        deduplicationKey: 'study-2:run-2:3:terminal',
        summary: {
          ...terminalTransition.summary,
          studyInstanceUID: 'study-2',
          runId: 'run-2',
          version: 3,
        },
      },
      undefined,
      2000,
      false
    );

    const withFirst = addRecentInferenceNotification([], first, 1);
    expect(addRecentInferenceNotification(withFirst, first, 1)).toBe(withFirst);
    expect(addRecentInferenceNotification(withFirst, second, 1)).toEqual([second]);
  });

  it('keeps only the most recent bounded notifications and marks them read', () => {
    const notifications = Array.from({ length: 25 }, (_, index) =>
      createStudyEventInferenceNotification(
        {
          ...terminalTransition,
          deduplicationKey: `study-${index}:run-${index}:7:terminal`,
          summary: {
            ...terminalTransition.summary,
            studyInstanceUID: `study-${index}`,
            runId: `run-${index}`,
          },
        },
        undefined,
        index,
        false
      )
    ).reduce(
      (recent, notification) => addRecentInferenceNotification(recent, notification, 20),
      []
    );

    expect(notifications).toHaveLength(20);
    expect(notifications[0].studyInstanceUID).toBe('study-24');
    expect(notifications[19].studyInstanceUID).toBe('study-5');
    expect(markAllInferenceNotificationsRead(notifications).every(item => item.read)).toBe(true);
  });

  it('keeps terminal outcome and attention presentation independent', () => {
    const terminal = createStudyEventInferenceNotification(
      terminalTransition,
      undefined,
      1000,
      false
    );
    const attention = createStudyEventInferenceNotification(
      {
        ...terminalTransition,
        deduplicationKey: 'study-1:run-1:7:attention',
        kind: 'attention',
      },
      undefined,
      1000,
      false
    );

    expect(getInferenceNotificationPresentation(terminal).labelKey).toBe('ProcessingStatusSuccess');
    expect(getInferenceNotificationPresentation(attention).labelKey).toBe(
      'ProcessingRequiresAttention'
    );
  });

  it('adapts candidate polling only as a temporary rollback source', () => {
    const notification = createCandidatePollInferenceNotification(
      {
        candidateId: 'candidate-1',
        studyInstanceUID: 'study-1',
        patientId: 'Fallback patient',
        modalitiesInStudy: 'US',
        processingStatus: 'failed',
        processingStatusAt: 100,
      },
      1000,
      false
    );

    expect(notification).toEqual(
      expect.objectContaining({
        source: 'candidate-poll',
        outcome: 'FAILED',
        deduplicationKey: 'candidate:candidate-1:100',
      })
    );
  });
});
