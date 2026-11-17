import { studyProcessingSummaryFixtures } from '../studyProcessing/fixtures';
import type { StudyProcessingNotificationTransition } from '../studyProcessing/notificationTransitions';
import {
  addRecentInferenceNotification,
  applyStudyNotificationMetadata,
  getInferenceNotificationLabels,
  mergeStudyNotificationMetadata,
  needsStudyNotificationMetadata,
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

  describe('study metadata resolved from the server', () => {
    const t = (key: string, options: Record<string, unknown> = {}) =>
      [key, ...Object.values(options)].join('|');
    const resolved = {
      accessionNumber: 'SYN-ACC-42',
      modalitiesInStudy: 'US',
      patientId: 'SYN-0001',
      patientName: 'SYNTHETIC^PATIENT',
      studyInstanceUID: 'study-1',
    };
    const unresolved = createStudyEventInferenceNotification(
      terminalTransition,
      undefined,
      1000,
      false
    );

    it('fills the missing labels of the matching notifications in place', () => {
      const other = { ...unresolved, deduplicationKey: 'other', studyInstanceUID: 'study-2' };
      const notifications = [unresolved, other];

      const next = applyStudyNotificationMetadata(notifications, resolved);

      expect(needsStudyNotificationMetadata(unresolved)).toBe(true);
      expect(next[0]).toEqual(
        expect.objectContaining({
          deduplicationKey: unresolved.deduplicationKey,
          patientName: 'SYNTHETIC^PATIENT',
          patientId: 'SYN-0001',
          accessionNumber: 'SYN-ACC-42',
          modalitiesInStudy: 'US',
          read: false,
        })
      );
      expect(needsStudyNotificationMetadata(next[0])).toBe(false);
      expect(next[1]).toBe(other);
      expect(applyStudyNotificationMetadata(next, resolved)).toBe(next);
    });

    it('keeps what the work list already supplied', () => {
      const fromWorklist = { ...unresolved, patientName: 'Visible patient' };

      expect(mergeStudyNotificationMetadata(fromWorklist, resolved)).toEqual(
        expect.objectContaining({ patientName: 'Visible patient', modalitiesInStudy: 'US' })
      );
      expect(mergeStudyNotificationMetadata(fromWorklist, null)).toBe(fromWorklist);
    });

    it('labels a resolved study with its patient and modalities', () => {
      expect(
        getInferenceNotificationLabels(mergeStudyNotificationMetadata(unresolved, resolved), t)
      ).toEqual({ primary: 'SYNTHETIC^PATIENT', secondary: 'US' });
    });

    it('falls back to the MRN when the study has no patient name', () => {
      expect(
        getInferenceNotificationLabels(
          mergeStudyNotificationMetadata(unresolved, { ...resolved, patientName: null }),
          t
        )
      ).toEqual({ primary: 'SYN-0001', secondary: 'US' });
    });

    it('identifies an unresolved study by its accession number', () => {
      expect(
        getInferenceNotificationLabels({ ...unresolved, accessionNumber: 'SYN-ACC-42' }, t)
      ).toEqual({
        primary: 'ProcessingNotificationUnknownStudy',
        secondary: 'ProcessingNotificationAccession|SYN-ACC-42',
      });
    });

    it('identifies an unresolved study by the end of its study UID', () => {
      expect(
        getInferenceNotificationLabels(
          { ...unresolved, studyInstanceUID: '1.2.826.0.1.3680043.8.498.12345678' },
          t
        )
      ).toEqual({
        primary: 'ProcessingNotificationUnknownStudy',
        secondary: 'ProcessingNotificationStudyReference|12345678',
      });
    });

    it('keeps the generic wording only when there is nothing to show', () => {
      expect(getInferenceNotificationLabels({ ...unresolved, studyInstanceUID: '' }, t)).toEqual({
        primary: 'ProcessingNotificationUnknownStudy',
        secondary: 'ProcessingNotificationUnknownModality',
      });
    });
  });
});
