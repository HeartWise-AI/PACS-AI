import {
  getStudyProcessingFeatureAvailability,
  parseBooleanFeatureFlag,
  resolveStudyProcessingFeatureFlags,
  type StudyProcessingFeatureFlags,
} from './featureFlags';

const allEnabled: StudyProcessingFeatureFlags = {
  candidatePollingEnabled: true,
  fixturePreviewEnabled: true,
  manualReprocessingEnabled: true,
  processingUIEnabled: true,
  realtimeSSEEnabled: true,
  restSnapshotsEnabled: true,
  runHistoryEnabled: true,
  studyEventNotificationsEnabled: true,
};

describe('study processing feature flags', () => {
  test.each(['true', 'TRUE', '1', 'yes', 'on'])('parses %s as enabled', value => {
    expect(parseBooleanFeatureFlag(value, false)).toBe(true);
  });

  test.each(['false', 'FALSE', '0', 'no', 'off'])('parses %s as disabled', value => {
    expect(parseBooleanFeatureFlag(value, true)).toBe(false);
  });

  test('accepts native runtime booleans and defaults invalid configuration', () => {
    expect(parseBooleanFeatureFlag(true, false)).toBe(true);
    expect(parseBooleanFeatureFlag(false, true)).toBe(false);
    expect(parseBooleanFeatureFlag(undefined, true)).toBe(true);
    expect(parseBooleanFeatureFlag('invalid', false)).toBe(false);
  });

  test('lets runtime configuration override build-time environment values', () => {
    expect(
      resolveStudyProcessingFeatureFlags(
        {
          processingUIEnabled: false,
          realtimeSSEEnabled: 'true',
        },
        {
          APP_PUBLIC_STUDY_PROCESSING_UI_ENABLED: 'true',
          APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED: 'false',
        }
      )
    ).toMatchObject({
      fixturePreviewEnabled: false,
      processingUIEnabled: false,
      realtimeSSEEnabled: true,
    });
  });

  test('uses rollout-safe defaults and keeps fixture preview opt-in', () => {
    expect(resolveStudyProcessingFeatureFlags({}, {})).toEqual({
      ...allEnabled,
      fixturePreviewEnabled: false,
    });
  });

  test('enables the complete authorized processing pipeline', () => {
    expect(getStudyProcessingFeatureAvailability(true, allEnabled)).toEqual({
      canPollCandidates: true,
      canReprocessStudy: true,
      canUseCandidateNotificationFallback: false,
      canUseFixturePreview: true,
      canUseRESTSnapshots: true,
      canUseRealtimeSSE: true,
      canUseStudyEventNotifications: true,
      canViewProcessing: true,
      canViewRunHistory: true,
    });
  });

  test('falls back to candidate notifications when live notifications are disabled', () => {
    expect(
      getStudyProcessingFeatureAvailability(true, {
        ...allEnabled,
        studyEventNotificationsEnabled: false,
      })
    ).toMatchObject({
      canPollCandidates: true,
      canUseCandidateNotificationFallback: true,
      canUseRealtimeSSE: true,
      canUseStudyEventNotifications: false,
    });
  });

  test('disabling REST also disables dependent history, SSE, notifications, and reprocessing', () => {
    expect(
      getStudyProcessingFeatureAvailability(true, {
        ...allEnabled,
        restSnapshotsEnabled: false,
      })
    ).toMatchObject({
      canReprocessStudy: false,
      canUseRESTSnapshots: false,
      canUseRealtimeSSE: false,
      canUseStudyEventNotifications: false,
      canViewProcessing: true,
      canViewRunHistory: false,
    });
  });

  test('disabling the processing UI releases every protected capability', () => {
    expect(
      getStudyProcessingFeatureAvailability(true, {
        ...allEnabled,
        processingUIEnabled: false,
      })
    ).toEqual({
      canPollCandidates: false,
      canReprocessStudy: false,
      canUseCandidateNotificationFallback: false,
      canUseFixturePreview: false,
      canUseRESTSnapshots: false,
      canUseRealtimeSSE: false,
      canUseStudyEventNotifications: false,
      canViewProcessing: false,
      canViewRunHistory: false,
    });
  });

  test('disables protected processing features without the required role', () => {
    expect(getStudyProcessingFeatureAvailability(false, allEnabled)).toEqual({
      canPollCandidates: false,
      canReprocessStudy: false,
      canUseCandidateNotificationFallback: false,
      canUseFixturePreview: false,
      canUseRESTSnapshots: false,
      canUseRealtimeSSE: false,
      canUseStudyEventNotifications: false,
      canViewProcessing: false,
      canViewRunHistory: false,
    });
  });
});
