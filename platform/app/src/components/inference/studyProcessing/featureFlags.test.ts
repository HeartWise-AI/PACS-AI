import { getStudyProcessingFeatureAvailability, parseBooleanFeatureFlag } from './featureFlags';

describe('study processing feature flags', () => {
  test.each(['true', 'TRUE', '1', 'yes', 'on'])('parses %s as enabled', value => {
    expect(parseBooleanFeatureFlag(value, false)).toBe(true);
  });

  test.each(['false', 'FALSE', '0', 'no', 'off'])('parses %s as disabled', value => {
    expect(parseBooleanFeatureFlag(value, true)).toBe(false);
  });

  test('uses the supplied default for missing or invalid configuration', () => {
    expect(parseBooleanFeatureFlag(undefined, true)).toBe(true);
    expect(parseBooleanFeatureFlag('invalid', false)).toBe(false);
  });

  test('keeps SSE and candidate polling independently controllable', () => {
    expect(
      getStudyProcessingFeatureAvailability(true, {
        candidatePollingEnabled: true,
        realtimeSSEEnabled: false,
      })
    ).toEqual({
      canUseCandidateNotificationFallback: true,
      canUseStudyEventNotifications: false,
      canPollCandidates: true,
      canUseRealtimeSSE: false,
      canViewProcessing: true,
    });

    expect(
      getStudyProcessingFeatureAvailability(true, {
        candidatePollingEnabled: false,
        realtimeSSEEnabled: true,
      })
    ).toEqual({
      canUseCandidateNotificationFallback: false,
      canUseStudyEventNotifications: true,
      canPollCandidates: false,
      canUseRealtimeSSE: true,
      canViewProcessing: true,
    });
  });

  test('prefers live study events when both transports are enabled', () => {
    expect(
      getStudyProcessingFeatureAvailability(true, {
        candidatePollingEnabled: true,
        realtimeSSEEnabled: true,
      })
    ).toEqual({
      canUseCandidateNotificationFallback: false,
      canUseStudyEventNotifications: true,
      canPollCandidates: true,
      canUseRealtimeSSE: true,
      canViewProcessing: true,
    });
  });

  test('disables notifications when both transports are disabled', () => {
    expect(
      getStudyProcessingFeatureAvailability(true, {
        candidatePollingEnabled: false,
        realtimeSSEEnabled: false,
      })
    ).toEqual({
      canUseCandidateNotificationFallback: false,
      canUseStudyEventNotifications: false,
      canPollCandidates: false,
      canUseRealtimeSSE: false,
      canViewProcessing: true,
    });
  });

  test('disables protected processing features without the required role', () => {
    expect(
      getStudyProcessingFeatureAvailability(false, {
        candidatePollingEnabled: true,
        realtimeSSEEnabled: true,
      })
    ).toEqual({
      canUseCandidateNotificationFallback: false,
      canUseStudyEventNotifications: false,
      canPollCandidates: false,
      canUseRealtimeSSE: false,
      canViewProcessing: false,
    });
  });
});
