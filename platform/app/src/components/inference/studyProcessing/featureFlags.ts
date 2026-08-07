export interface StudyProcessingFeatureFlags {
  candidatePollingEnabled: boolean;
  realtimeSSEEnabled: boolean;
}

export interface StudyProcessingFeatureAvailability {
  canUseCandidateNotificationFallback: boolean;
  canUseStudyEventNotifications: boolean;
  canPollCandidates: boolean;
  canUseRealtimeSSE: boolean;
  canViewProcessing: boolean;
}

export function parseBooleanFeatureFlag(value: string | undefined, defaultValue: boolean): boolean {
  switch (value?.trim().toLowerCase()) {
    case 'true':
    case '1':
    case 'yes':
    case 'on':
      return true;
    case 'false':
    case '0':
    case 'no':
    case 'off':
      return false;
    default:
      return defaultValue;
  }
}

export const studyProcessingFeatureFlags: StudyProcessingFeatureFlags = {
  candidatePollingEnabled: parseBooleanFeatureFlag(
    process.env.APP_PUBLIC_CANDIDATE_PROCESSING_POLL_ENABLED,
    true
  ),
  realtimeSSEEnabled: parseBooleanFeatureFlag(
    process.env.APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED,
    true
  ),
};

export function getStudyProcessingFeatureAvailability(
  hasProcessingRole: boolean,
  flags: StudyProcessingFeatureFlags = studyProcessingFeatureFlags
): StudyProcessingFeatureAvailability {
  const canPollCandidates = hasProcessingRole && flags.candidatePollingEnabled;
  const canUseRealtimeSSE = hasProcessingRole && flags.realtimeSSEEnabled;

  return {
    canUseCandidateNotificationFallback: canPollCandidates && !canUseRealtimeSSE,
    canUseStudyEventNotifications: canUseRealtimeSSE,
    canPollCandidates,
    canUseRealtimeSSE,
    canViewProcessing: hasProcessingRole,
  };
}
