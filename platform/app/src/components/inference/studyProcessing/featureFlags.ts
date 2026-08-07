export interface StudyProcessingFeatureFlags {
  candidatePollingEnabled: boolean;
  fixturePreviewEnabled: boolean;
  manualReprocessingEnabled: boolean;
  processingUIEnabled: boolean;
  realtimeSSEEnabled: boolean;
  restSnapshotsEnabled: boolean;
  runHistoryEnabled: boolean;
  studyEventNotificationsEnabled: boolean;
}

export type StudyProcessingFeatureFlagOverrides = Partial<
  Record<keyof StudyProcessingFeatureFlags, boolean | string>
>;

export interface StudyProcessingFeatureAvailability {
  canPollCandidates: boolean;
  canReprocessStudy: boolean;
  canUseCandidateNotificationFallback: boolean;
  canUseFixturePreview: boolean;
  canUseRESTSnapshots: boolean;
  canUseRealtimeSSE: boolean;
  canUseStudyEventNotifications: boolean;
  canViewProcessing: boolean;
  canViewRunHistory: boolean;
}

interface StudyProcessingEnvironmentFlags {
  APP_PUBLIC_CANDIDATE_PROCESSING_POLL_ENABLED?: string;
  APP_PUBLIC_STUDY_PROCESSING_FIXTURES_ENABLED?: string;
  APP_PUBLIC_STUDY_PROCESSING_HISTORY_ENABLED?: string;
  APP_PUBLIC_STUDY_PROCESSING_NOTIFICATIONS_ENABLED?: string;
  APP_PUBLIC_STUDY_PROCESSING_REPROCESS_ENABLED?: string;
  APP_PUBLIC_STUDY_PROCESSING_REST_ENABLED?: string;
  APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED?: string;
  APP_PUBLIC_STUDY_PROCESSING_UI_ENABLED?: string;
}

const DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS: StudyProcessingFeatureFlags = {
  candidatePollingEnabled: true,
  fixturePreviewEnabled: false,
  manualReprocessingEnabled: true,
  processingUIEnabled: true,
  realtimeSSEEnabled: true,
  restSnapshotsEnabled: true,
  runHistoryEnabled: true,
  studyEventNotificationsEnabled: true,
};

export function parseBooleanFeatureFlag(
  value: boolean | string | undefined,
  defaultValue: boolean
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

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

function environmentFeatureFlags(
  environment: StudyProcessingEnvironmentFlags
): StudyProcessingFeatureFlags {
  return {
    candidatePollingEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_CANDIDATE_PROCESSING_POLL_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.candidatePollingEnabled
    ),
    fixturePreviewEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_STUDY_PROCESSING_FIXTURES_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.fixturePreviewEnabled
    ),
    manualReprocessingEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_STUDY_PROCESSING_REPROCESS_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.manualReprocessingEnabled
    ),
    processingUIEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_STUDY_PROCESSING_UI_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.processingUIEnabled
    ),
    realtimeSSEEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.realtimeSSEEnabled
    ),
    restSnapshotsEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_STUDY_PROCESSING_REST_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.restSnapshotsEnabled
    ),
    runHistoryEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_STUDY_PROCESSING_HISTORY_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.runHistoryEnabled
    ),
    studyEventNotificationsEnabled: parseBooleanFeatureFlag(
      environment.APP_PUBLIC_STUDY_PROCESSING_NOTIFICATIONS_ENABLED,
      DEFAULT_STUDY_PROCESSING_FEATURE_FLAGS.studyEventNotificationsEnabled
    ),
  };
}

function runtimeFeatureFlagOverrides(): StudyProcessingFeatureFlagOverrides {
  if (typeof window === 'undefined') {
    return {};
  }

  const runtimeConfig = window.config as
    | { studyProcessing?: StudyProcessingFeatureFlagOverrides }
    | undefined;
  return runtimeConfig?.studyProcessing ?? {};
}

export function resolveStudyProcessingFeatureFlags(
  runtimeOverrides: StudyProcessingFeatureFlagOverrides = runtimeFeatureFlagOverrides(),
  environment: StudyProcessingEnvironmentFlags = process.env
): StudyProcessingFeatureFlags {
  const environmentFlags = environmentFeatureFlags(environment);

  return Object.fromEntries(
    Object.entries(environmentFlags).map(([name, environmentValue]) => [
      name,
      parseBooleanFeatureFlag(
        runtimeOverrides[name as keyof StudyProcessingFeatureFlags],
        environmentValue
      ),
    ])
  ) as unknown as StudyProcessingFeatureFlags;
}

export function getStudyProcessingFeatureAvailability(
  hasProcessingRole: boolean,
  flags: StudyProcessingFeatureFlags = resolveStudyProcessingFeatureFlags()
): StudyProcessingFeatureAvailability {
  const canViewProcessing = hasProcessingRole && flags.processingUIEnabled;
  const canUseRESTSnapshots = canViewProcessing && flags.restSnapshotsEnabled;
  const canUseRealtimeSSE = canUseRESTSnapshots && flags.realtimeSSEEnabled;
  const canUseStudyEventNotifications = canUseRealtimeSSE && flags.studyEventNotificationsEnabled;
  const canPollCandidates = canViewProcessing && flags.candidatePollingEnabled;
  const canViewRunHistory = canUseRESTSnapshots && flags.runHistoryEnabled;

  return {
    canPollCandidates,
    canReprocessStudy: canViewRunHistory && canUseRESTSnapshots && flags.manualReprocessingEnabled,
    canUseCandidateNotificationFallback: canPollCandidates && !canUseStudyEventNotifications,
    canUseFixturePreview: canViewProcessing && flags.fixturePreviewEnabled,
    canUseRESTSnapshots,
    canUseRealtimeSSE,
    canUseStudyEventNotifications,
    canViewProcessing,
    canViewRunHistory,
  };
}
