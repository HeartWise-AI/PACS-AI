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
      canPollCandidates: false,
      canUseRealtimeSSE: true,
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
      canPollCandidates: false,
      canUseRealtimeSSE: false,
      canViewProcessing: false,
    });
  });
});
