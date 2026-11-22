import { studyProcessingSummaryFixtures } from './fixtures';
import { deriveLiveStudyProcessingNotificationTransitions } from './notificationTransitions';
import type { StudyProcessingSummary } from './types';

const processingSummary = (
  overrides: Partial<StudyProcessingSummary> = {}
): StudyProcessingSummary => ({
  ...studyProcessingSummaryFixtures.processing,
  ...overrides,
});

describe('deriveLiveStudyProcessingNotificationTransitions', () => {
  it('detects one terminal transition for a newer live event', () => {
    const previous = processingSummary();
    const incoming = processingSummary({
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'SUCCESS',
      version: 5,
    });

    expect(deriveLiveStudyProcessingNotificationTransitions(previous, incoming)).toEqual([
      {
        deduplicationKey: `${incoming.studyInstanceUID}:${incoming.runId}:5:terminal`,
        kind: 'terminal',
        summary: incoming,
      },
    ]);
  });

  it('detects attention independently from a terminal outcome', () => {
    const previous = processingSummary();
    const incoming = processingSummary({
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'PARTIAL_SUCCESS',
      attentionRequired: true,
      attentionReasons: [{ code: 'EXPECTED_JOB_MISSING', message: null }],
      version: 5,
    });

    expect(
      deriveLiveStudyProcessingNotificationTransitions(previous, incoming).map(
        transition => transition.kind
      )
    ).toEqual(['terminal', 'attention']);
  });

  it('does not notify again for later versions of the same terminal or attention state', () => {
    const previous = processingSummary({
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'FAILED',
      attentionRequired: true,
      version: 5,
    });
    const incoming = processingSummary({
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'FAILED',
      attentionRequired: true,
      version: 6,
    });

    expect(deriveLiveStudyProcessingNotificationTransitions(previous, incoming)).toEqual([]);
  });

  it('ignores duplicate and out-of-order updates', () => {
    const previous = processingSummary({ version: 5 });

    expect(
      deriveLiveStudyProcessingNotificationTransitions(
        previous,
        processingSummary({
          lifecycle: 'TERMINAL',
          phase: 'TERMINAL',
          outcome: 'SUCCESS',
          version: 5,
        })
      )
    ).toEqual([]);
    expect(
      deriveLiveStudyProcessingNotificationTransitions(
        previous,
        processingSummary({
          lifecycle: 'TERMINAL',
          phase: 'TERMINAL',
          outcome: 'SUCCESS',
          version: 4,
        })
      )
    ).toEqual([]);
  });

  it('treats a terminal event for a newer run as a new logical transition', () => {
    const previous = processingSummary({
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'SUCCESS',
      version: 8,
    });
    const incoming = processingSummary({
      runId: 'run-processing-2',
      runNumber: 2,
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'SUCCESS_WITH_SKIPS',
      version: 1,
    });

    expect(
      deriveLiveStudyProcessingNotificationTransitions(previous, incoming).map(
        transition => transition.kind
      )
    ).toEqual(['terminal']);
  });

  it('can notify for the first live run event but never for retrieval-only state', () => {
    const terminal = processingSummary({
      lifecycle: 'TERMINAL',
      phase: 'TERMINAL',
      outcome: 'SUCCESS',
      version: 5,
    });

    expect(
      deriveLiveStudyProcessingNotificationTransitions(undefined, terminal).map(
        transition => transition.kind
      )
    ).toEqual(['terminal']);
    expect(
      deriveLiveStudyProcessingNotificationTransitions(
        undefined,
        studyProcessingSummaryFixtures.retrieving
      )
    ).toEqual([]);
  });
});
