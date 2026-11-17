import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import InferenceProcessingProvider, { useInferenceProcessing } from './InferenceProcessingProvider';
import { studyProcessingSummaryFixtures } from '../studyProcessing/fixtures';
import type { StudyProcessingNotificationTransition } from '../studyProcessing/notificationTransitions';
import type { ResolvedStudyNotificationMetadata } from './studyNotificationMetadata';

const mockShow = jest.fn();
const mockFetchStudyNotificationMetadata = jest.fn();
const mockClearStudyProcessingState = jest.fn();
const mockTranslate = (key: string, options: Record<string, unknown> = {}) =>
  [key, ...Object.values(options)].join('|');

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

jest.mock('../hooks/usePathname', () => ({
  __esModule: true,
  default: () => '/',
}));

jest.mock('@ohif/ui-next', () => ({
  useNotification: () => ({ show: mockShow }),
}));

jest.mock('../api/userRepository', () => ({
  __esModule: true,
  default: {
    GetCurrentUser: () =>
      Promise.resolve({ data: { id: 'user-1', tenantId: 'tenant-1', role: 'member' } }),
  },
}));

jest.mock('../hooks/useCandidateProcessingPoll', () => ({
  useCandidateProcessingPoll: jest.fn(),
}));

jest.mock('../studyProcessing/StudyProcessingProvider', () => ({
  useStudyProcessing: () => ({ clearStudyProcessingState: mockClearStudyProcessingState }),
}));

jest.mock('./studyNotificationMetadataRepository', () => ({
  fetchStudyNotificationMetadata: (studyInstanceUID: string) =>
    mockFetchStudyNotificationMetadata(studyInstanceUID),
}));

// Synthetic identifiers only.
const STUDY_UID = '1.2.826.0.1.3680043.8.498.12345678';
const resolvedMetadata: ResolvedStudyNotificationMetadata = {
  accessionNumber: 'SYN-ACC-42',
  modalitiesInStudy: 'US',
  patientId: 'SYN-0001',
  patientName: 'SYNTHETIC^PATIENT',
  studyInstanceUID: STUDY_UID,
};

function transition(version: number): StudyProcessingNotificationTransition {
  return {
    deduplicationKey: `${STUDY_UID}:run-1:${version}:terminal`,
    kind: 'terminal',
    summary: {
      ...studyProcessingSummaryFixtures.success,
      studyInstanceUID: STUDY_UID,
      runId: 'run-1',
      version,
    },
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('InferenceProcessingProvider: notification study labels', () => {
  let renderer: ReactTestRenderer;
  let context: ReturnType<typeof useInferenceProcessing>;

  function Probe() {
    context = useInferenceProcessing();
    return null;
  }

  beforeEach(async () => {
    mockShow.mockClear();
    mockFetchStudyNotificationMetadata.mockReset();
    localStorage.setItem('sessionToken', 'session-token');
    act(() => {
      renderer = TestRenderer.create(
        <InferenceProcessingProvider>
          <Probe />
        </InferenceProcessingProvider>
      );
    });
    await flush();
  });

  afterEach(() => {
    act(() => renderer.unmount());
    localStorage.clear();
  });

  it('shows the notification at once and relabels it in place when the lookup answers', async () => {
    const lookup = deferred<ResolvedStudyNotificationMetadata | null>();
    mockFetchStudyNotificationMetadata.mockReturnValue(lookup.promise);

    act(() => context.handleStudyProcessingNotificationTransition(transition(7)));

    // Shown before the server answered, identified by the end of its UID.
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow.mock.calls[0][0].message).toBe(
      'ProcessingNotificationUnknownStudy · ProcessingNotificationStudyReference|12345678'
    );
    expect(context.notifications).toHaveLength(1);
    expect(context.notifications[0].patientName).toBeNull();
    await flush();
    expect(mockFetchStudyNotificationMetadata).toHaveBeenCalledWith(STUDY_UID);

    lookup.resolve(resolvedMetadata);
    await flush();

    expect(context.notifications).toHaveLength(1);
    expect(context.notifications[0]).toEqual(
      expect.objectContaining({
        deduplicationKey: transition(7).deduplicationKey,
        patientName: 'SYNTHETIC^PATIENT',
        modalitiesInStudy: 'US',
        read: false,
      })
    );
    expect(context.unreadCount).toBe(1);
    // The toast still on screen is rewritten under the same id.
    expect(mockShow).toHaveBeenCalledTimes(2);
    expect(mockShow.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        id: transition(7).deduplicationKey,
        message: 'SYNTHETIC^PATIENT · US',
      })
    );
  });

  it('keeps the fallback labels when the lookup fails', async () => {
    mockFetchStudyNotificationMetadata.mockRejectedValue(new Error('network'));

    act(() => context.handleStudyProcessingNotificationTransition(transition(7)));
    await flush();

    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(context.notifications).toHaveLength(1);
    expect(context.notifications[0]).toEqual(
      expect.objectContaining({ patientName: null, modalitiesInStudy: null })
    );
  });

  it('looks a study up once for notifications that arrive together', async () => {
    const lookup = deferred<ResolvedStudyNotificationMetadata | null>();
    mockFetchStudyNotificationMetadata.mockReturnValue(lookup.promise);

    act(() => {
      context.handleStudyProcessingNotificationTransition(transition(7));
      context.handleStudyProcessingNotificationTransition(transition(8));
    });
    await flush();
    lookup.resolve(resolvedMetadata);
    await flush();

    expect(mockFetchStudyNotificationMetadata).toHaveBeenCalledTimes(1);
    expect(context.notifications.map(item => item.patientName)).toEqual([
      'SYNTHETIC^PATIENT',
      'SYNTHETIC^PATIENT',
    ]);
  });

  it('labels a later toast of the same study from the cache', async () => {
    mockFetchStudyNotificationMetadata.mockResolvedValue(resolvedMetadata);

    act(() => context.handleStudyProcessingNotificationTransition(transition(7)));
    await flush();
    mockShow.mockClear();

    act(() => context.handleStudyProcessingNotificationTransition(transition(8)));
    await flush();

    expect(mockFetchStudyNotificationMetadata).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow.mock.calls[0][0].message).toBe('SYNTHETIC^PATIENT · US');
  });

  it('does not look up a study the work list already described', async () => {
    act(() =>
      context.setVisibleStudyNotificationMetadata([
        { studyInstanceUID: STUDY_UID, patientName: 'Visible patient', modalitiesInStudy: 'XA' },
      ])
    );
    act(() => context.handleStudyProcessingNotificationTransition(transition(7)));
    await flush();

    expect(mockFetchStudyNotificationMetadata).not.toHaveBeenCalled();
    expect(mockShow.mock.calls[0][0].message).toBe('Visible patient · XA');
  });

  it('does not bring a toast back when the lookup answers late', async () => {
    const lookup = deferred<ResolvedStudyNotificationMetadata | null>();
    mockFetchStudyNotificationMetadata.mockReturnValue(lookup.promise);
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);

    act(() => context.handleStudyProcessingNotificationTransition(transition(7)));
    await flush();
    now.mockReturnValue(1_000_000 + 60_000);
    lookup.resolve(resolvedMetadata);
    await flush();
    now.mockRestore();

    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(context.notifications[0].patientName).toBe('SYNTHETIC^PATIENT');
  });
});
