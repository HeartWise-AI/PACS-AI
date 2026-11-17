import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import InferenceProcessingProvider, {
  TOAST_BURST_WINDOW_MS,
  useInferenceProcessing,
} from './InferenceProcessingProvider';
import { NOTIFICATION_PREFERENCES_CHANGED_EVENT } from './notificationPreferences';
import { studyProcessingSummaryFixtures } from '../studyProcessing/fixtures';
import type { StudyProcessingNotificationTransition } from '../studyProcessing/notificationTransitions';
import type { StudyProcessingSummary } from '../studyProcessing/types';
import { useCandidateProcessingPoll } from '../hooks/useCandidateProcessingPoll';

const mockShow = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetUserMetadata = jest.fn();
const mockClearStudyProcessingState = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
}));

jest.mock('@ohif/ui-next', () => ({
  useNotification: () => ({ show: mockShow }),
}));

jest.mock('../api/userRepository', () => ({
  __esModule: true,
  default: {
    GetCurrentUser: () => mockGetCurrentUser(),
    GetUserMetadata: () => mockGetUserMetadata(),
  },
}));

jest.mock('../hooks/useCandidateProcessingPoll', () => ({
  useCandidateProcessingPoll: jest.fn(),
}));

jest.mock('../studyProcessing/StudyProcessingProvider', () => ({
  useStudyProcessing: () => ({ clearStudyProcessingState: mockClearStudyProcessingState }),
}));

jest.mock('./studyNotificationMetadataRepository', () => ({
  fetchStudyNotificationMetadata: () => Promise.resolve(null),
}));

// Synthetic identifiers only.
const STUDY_A = '1.2.826.0.1.3680043.8.498.11111111';
const STUDY_B = '1.2.826.0.1.3680043.8.498.22222222';

function transition(
  version: number,
  overrides: Partial<StudyProcessingSummary> = {},
  kind: 'terminal' | 'attention' = 'terminal'
): StudyProcessingNotificationTransition {
  const summary = {
    ...studyProcessingSummaryFixtures.success,
    studyInstanceUID: STUDY_A,
    runId: 'run-1',
    version,
    notify: true,
    ...overrides,
  };
  return {
    deduplicationKey: `${summary.studyInstanceUID}:${summary.runId}:${version}:${kind}`,
    kind,
    summary,
  };
}

async function flush() {
  await act(async () => {
    for (let index = 0; index < 6; index++) {
      await Promise.resolve();
    }
  });
}

describe('InferenceProcessingProvider: notification audience', () => {
  let renderer: ReactTestRenderer;
  let context: ReturnType<typeof useInferenceProcessing>;

  function Probe() {
    context = useInferenceProcessing();
    return null;
  }

  async function mount(role: string, metadata: Record<string, unknown> | null = null) {
    mockGetCurrentUser.mockResolvedValue({ data: { id: 'user-1', tenantId: 'tenant-1', role } });
    if (metadata) {
      mockGetUserMetadata.mockResolvedValue({ data: { metadata } });
    } else {
      mockGetUserMetadata.mockRejectedValue({ errorCode: 'MISSING_RECORD' });
    }
    act(() => {
      renderer = TestRenderer.create(
        <InferenceProcessingProvider>
          <Probe />
        </InferenceProcessingProvider>
      );
    });
    await flush();
  }

  beforeEach(() => {
    mockShow.mockClear();
    mockGetCurrentUser.mockReset();
    mockGetUserMetadata.mockReset();
    (useCandidateProcessingPoll as jest.Mock).mockClear();
    localStorage.setItem('sessionToken', 'session-token');
  });

  afterEach(() => {
    act(() => renderer.unmount());
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('never raises a notification the gateway left out of the audience', async () => {
    await mount('ADMIN');
    act(() =>
      context.handleStudyProcessingNotificationTransition(transition(7, { notify: false }))
    );
    expect(mockShow).not.toHaveBeenCalled();
    expect(context.notifications).toHaveLength(0);
  });

  it('tells a role-USER member only the outcome of their own run', async () => {
    await mount('USER');
    act(() => {
      context.handleStudyProcessingNotificationTransition(
        transition(
          5,
          {
            trigger: 'VIEWER_REQUEST',
            phase: 'PROCESSING',
            outcome: null,
            attentionRequired: true,
          },
          'attention'
        )
      );
    });
    expect(context.notifications).toHaveLength(0);

    act(() =>
      context.handleStudyProcessingNotificationTransition(
        transition(6, { trigger: 'VIEWER_REQUEST', outcome: 'FAILED' })
      )
    );
    expect(context.notifications).toHaveLength(1);
    expect(context.notifications[0]).toEqual(
      expect.objectContaining({ outcome: 'FAILED', trigger: 'VIEWER_REQUEST' })
    );

    act(() =>
      context.handleStudyProcessingNotificationTransition(
        transition(9, {
          runId: 'run-2',
          trigger: 'VIEWER_REQUEST',
          outcome: 'CANCELLED',
          cancelledByYou: true,
        })
      )
    );
    expect(context.notifications).toHaveLength(1);
  });

  it('keeps intermediate transitions of automatic runs for admins', async () => {
    await mount('OWNER');
    act(() =>
      context.handleStudyProcessingNotificationTransition(
        transition(5, { trigger: 'AUTO', phase: 'PROCESSING', outcome: null }, 'attention')
      )
    );
    expect(context.notifications).toHaveLength(1);
    expect(context.notifications[0].trigger).toBe('AUTO');
  });

  it('applies the stored mute of automatic analyses', async () => {
    await mount('ADMIN', { notifyAutomaticRuns: false, tutorialProgressStep: 3 });
    act(() =>
      context.handleStudyProcessingNotificationTransition(transition(7, { trigger: 'AUTO' }))
    );
    expect(context.notifications).toHaveLength(0);

    act(() =>
      context.handleStudyProcessingNotificationTransition(
        transition(8, { runId: 'run-2', trigger: 'MANUAL_REPROCESS' })
      )
    );
    expect(context.notifications).toHaveLength(1);
  });

  it('applies the Settings toggle at once, to live events and to the candidate poll', async () => {
    await mount('ADMIN');
    const pollOptions = (useCandidateProcessingPoll as jest.Mock).mock.calls.at(-1)[0];

    act(() => {
      window.dispatchEvent(
        new CustomEvent(NOTIFICATION_PREFERENCES_CHANGED_EVENT, {
          detail: { notifyAutomaticRuns: false },
        })
      );
    });
    act(() => {
      context.handleStudyProcessingNotificationTransition(transition(7, { trigger: 'AUTO' }));
      pollOptions.onTransition({
        candidateId: 'candidate-1',
        studyInstanceUID: STUDY_B,
        patientId: 'SYN-0002',
        modalitiesInStudy: 'XA',
        processingStatus: 'completed',
        processingStatusAt: 1_700_000_000,
      });
    });
    expect(context.notifications).toHaveLength(0);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(NOTIFICATION_PREFERENCES_CHANGED_EVENT, {
          detail: { notifyAutomaticRuns: true },
        })
      );
    });
    act(() =>
      context.handleStudyProcessingNotificationTransition(transition(8, { trigger: 'AUTO' }))
    );
    expect(context.notifications).toHaveLength(1);
  });

  it('collapses a burst of one study into one toast while the bell lists each', async () => {
    await mount('ADMIN');
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);

    act(() => context.handleStudyProcessingNotificationTransition(transition(7)));
    now.mockReturnValue(1_000_000 + 1_000);
    act(() =>
      context.handleStudyProcessingNotificationTransition(
        transition(8, { outcome: 'FAILED' }, 'attention')
      )
    );
    now.mockReturnValue(1_000_000 + 2_000);
    act(() =>
      context.handleStudyProcessingNotificationTransition(
        transition(9, { studyInstanceUID: STUDY_B })
      )
    );

    expect(context.notifications).toHaveLength(3);
    const toastIds = mockShow.mock.calls.map(call => call[0].id);
    expect(toastIds).toEqual([
      transition(7).deduplicationKey,
      transition(7).deduplicationKey,
      transition(9, { studyInstanceUID: STUDY_B }).deduplicationKey,
    ]);
    // The shared toast shows the latest notification of the burst.
    expect(mockShow.mock.calls[1][0].title).toBe('ProcessingNotificationTitle.ATTENTION');

    // Past the window, the study gets a new toast.
    now.mockReturnValue(1_000_000 + 1_000 + TOAST_BURST_WINDOW_MS + 1);
    act(() => context.handleStudyProcessingNotificationTransition(transition(10)));
    expect(mockShow.mock.calls.at(-1)[0].id).toBe(transition(10).deduplicationKey);
    expect(context.notifications).toHaveLength(4);
  });
});
