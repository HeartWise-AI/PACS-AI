import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '@ohif/ui-next';
import usePathname from '../hooks/usePathname';
import userRepository from '../api/userRepository';
import { UserRole } from '../api/userDTO';
import {
  useCandidateProcessingPoll,
  ProcessingTransitionEvent,
} from '../hooks/useCandidateProcessingPoll';
import { useStudyProcessing } from '../studyProcessing/StudyProcessingProvider';
import {
  getStudyProcessingAuthIdentity,
  shouldClearStudyProcessingState,
} from '../studyProcessing/authIdentity';
import {
  getStudyProcessingFeatureAvailability,
  resolveStudyProcessingFeatureFlags,
} from '../studyProcessing/featureFlags';
import { studyProcessingRolloutTelemetry } from '../studyProcessing/rolloutTelemetry';
import type { StudyProcessingNotificationTransition } from '../studyProcessing/notificationTransitions';
import {
  addRecentInferenceNotification,
  applyStudyNotificationMetadata,
  createCandidatePollInferenceNotification,
  createStudyEventInferenceNotification,
  getInferenceNotificationLabels,
  getInferenceNotificationPresentation,
  markAllInferenceNotificationsRead,
  mergeStudyNotificationMetadata,
  needsStudyNotificationMetadata,
  type InferenceNotification,
  type StudyNotificationWorklistMetadata,
} from './inferenceNotifications';
import { createStudyNotificationMetadataResolver } from './studyNotificationMetadata';
import { fetchStudyNotificationMetadata } from './studyNotificationMetadataRepository';
import {
  DEFAULT_NOTIFICATION_AUDIENCE_VIEWER,
  shouldRaiseCandidatePollNotification,
  shouldRaiseStudyProcessingNotification,
  type NotificationAudienceViewer,
} from './notificationAudience';
import {
  loadNotifyAutomaticRuns,
  NOTIFICATION_PREFERENCES_CHANGED_EVENT,
  type NotificationPreferencesChangedDetail,
} from './notificationPreferences';

const RECENT_LIMIT = 20;
// A toast stays up for five seconds. A lookup answered within this window
// rewrites the toast still on screen; a later answer only updates the bell, so
// a toast the user already saw go away is never brought back.
const TOAST_METADATA_UPDATE_WINDOW_MS = 3000;
// Notifications of one study arriving within this window of each other share
// one toast (the latest replaces it); the bell still lists each of them.
export const TOAST_BURST_WINDOW_MS = 4000;

type ToastBurst = {
  toastId: string;
  lastShownAt: number;
  latestDeduplicationKey: string;
};

type InferenceProcessingContextValue = {
  notifications: InferenceNotification[];
  unreadCount: number;
  canShowBell: boolean;
  canReprocessStudy: boolean;
  canUseStudyProcessingFixtures: boolean;
  canUseStudyProcessingREST: boolean;
  canViewStudyProcessing: boolean;
  canViewStudyProcessingRunHistory: boolean;
  canUseStudyProcessingRealtime: boolean;
  studyProcessingAuthIdentity: string | null;
  handleStudyProcessingNotificationTransition: (
    transition: StudyProcessingNotificationTransition
  ) => void;
  setVisibleStudyNotificationMetadata: (metadata: StudyNotificationWorklistMetadata[]) => void;
  markAllRead: () => void;
  isBellOpen: boolean;
  setBellOpen: (open: boolean) => void;
};

const InferenceProcessingContext = createContext<InferenceProcessingContextValue | null>(null);

export function useInferenceProcessing() {
  const context = useContext(InferenceProcessingContext);
  if (!context) {
    throw new Error('useInferenceProcessing must be used within InferenceProcessingProvider');
  }
  return context;
}

// For surfaces (such as the viewer) that must keep working when rendered
// outside the provider: returns null instead of throwing.
export function useOptionalInferenceProcessing() {
  return useContext(InferenceProcessingContext);
}

function InferenceProcessingProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('StudyList');
  const { show } = useNotification();
  // Mounted outside OHIF's router (serviceProvidersManager): follow the path
  // without React Router so the session is re-read after each navigation.
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<InferenceNotification[]>([]);
  const [canViewProcessing, setCanViewProcessing] = useState(false);
  const [canMutateProcessing, setCanMutateProcessing] = useState(false);
  const [studyProcessingAuthIdentity, setStudyProcessingAuthIdentity] = useState<string | null>(
    null
  );
  const [isBellOpen, setBellOpen] = useState(false);
  const isBellOpenRef = useRef(false);
  const authenticatedIdentityRef = useRef<string | null>(null);
  const notificationDeduplicationKeysRef = useRef(new Set<string>());
  const visibleStudyMetadataRef = useRef(new Map<string, StudyNotificationWorklistMetadata>());
  const candidateFallbackActiveRef = useRef(false);
  const toastBurstsRef = useRef(new Map<string, ToastBurst>());
  const audienceViewerRef = useRef<NotificationAudienceViewer>(
    DEFAULT_NOTIFICATION_AUDIENCE_VIEWER
  );
  const preferencesIdentityRef = useRef<string | null>(null);
  const studyMetadataResolverRef = useRef(
    createStudyNotificationMetadataResolver({
      fetchStudy: studyInstanceUID => fetchStudyNotificationMetadata(studyInstanceUID),
    })
  );
  const { clearStudyProcessingState } = useStudyProcessing();

  isBellOpenRef.current = isBellOpen;

  const clearNotificationState = useCallback(() => {
    notificationDeduplicationKeysRef.current = new Set();
    visibleStudyMetadataRef.current = new Map();
    toastBurstsRef.current = new Map();
    // Labels resolved for one signed-in identity must not outlive it.
    studyMetadataResolverRef.current.clear();
    setNotifications([]);
    setBellOpen(false);
  }, []);

  const setVisibleStudyNotificationMetadata = useCallback(
    (metadata: StudyNotificationWorklistMetadata[]) => {
      visibleStudyMetadataRef.current = new Map(
        metadata.map(item => [item.studyInstanceUID, item])
      );
    },
    []
  );

  const addNotification = useCallback(
    (incoming: InferenceNotification) => {
      if (notificationDeduplicationKeysRef.current.has(incoming.deduplicationKey)) {
        return;
      }

      notificationDeduplicationKeysRef.current.add(incoming.deduplicationKey);
      const resolver = studyMetadataResolverRef.current;
      // A study resolved earlier in the session is labelled straight away.
      const notification = mergeStudyNotificationMetadata(
        incoming,
        resolver.peek(incoming.studyInstanceUID)
      );
      const presentation = getInferenceNotificationPresentation(notification);
      const shownAt = Date.now();
      // Several notifications of one study within a few seconds share a toast.
      const burst = toastBurstsRef.current.get(notification.studyInstanceUID);
      const toastId =
        burst && shownAt - burst.lastShownAt <= TOAST_BURST_WINDOW_MS
          ? burst.toastId
          : notification.deduplicationKey;
      toastBurstsRef.current.set(notification.studyInstanceUID, {
        toastId,
        lastShownAt: shownAt,
        latestDeduplicationKey: notification.deduplicationKey,
      });
      const ownsToast = () =>
        toastBurstsRef.current.get(notification.studyInstanceUID)?.latestDeduplicationKey ===
        notification.deduplicationKey;
      const showToast = (shown: InferenceNotification) => {
        const labels = getInferenceNotificationLabels(shown, t);
        show({
          type: presentation.tone,
          title: t(presentation.titleKey),
          message: `${labels.primary} · ${labels.secondary}`,
          id: toastId,
        });
      };

      showToast(notification);

      setNotifications(previousNotifications => {
        const nextNotifications = addRecentInferenceNotification(
          previousNotifications,
          notification,
          RECENT_LIMIT
        );
        notificationDeduplicationKeysRef.current = new Set(
          nextNotifications.map(item => item.deduplicationKey)
        );
        return nextNotifications;
      });

      if (!needsStudyNotificationMetadata(notification)) {
        return;
      }

      // The notification is already shown; the lookup only improves its labels.
      void resolver.resolve(notification.studyInstanceUID).then(metadata => {
        if (!metadata) {
          return;
        }
        const resolved = mergeStudyNotificationMetadata(notification, metadata);
        if (resolved === notification) {
          return;
        }

        setNotifications(previousNotifications =>
          applyStudyNotificationMetadata(previousNotifications, metadata)
        );
        // A later notification of the same study now owns the shared toast.
        if (
          Date.now() - shownAt <= TOAST_METADATA_UPDATE_WINDOW_MS &&
          notificationDeduplicationKeysRef.current.has(notification.deduplicationKey) &&
          ownsToast()
        ) {
          showToast(resolved);
        }
      });
    },
    [show, t]
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveAuth() {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        if (!cancelled) {
          authenticatedIdentityRef.current = null;
          preferencesIdentityRef.current = null;
          audienceViewerRef.current = DEFAULT_NOTIFICATION_AUDIENCE_VIEWER;
          setStudyProcessingAuthIdentity(null);
          clearStudyProcessingState();
          setCanViewProcessing(false);
          setCanMutateProcessing(false);
          clearNotificationState();
        }
        return;
      }

      try {
        const response = await userRepository.GetCurrentUser();
        if (!cancelled) {
          const nextIdentity = getStudyProcessingAuthIdentity(response.data);
          if (shouldClearStudyProcessingState(authenticatedIdentityRef.current, nextIdentity)) {
            clearStudyProcessingState();
            clearNotificationState();
          }
          authenticatedIdentityRef.current = nextIdentity;
          setStudyProcessingAuthIdentity(nextIdentity);

          const role = response.data.role;
          const isAdmin = role === UserRole.ADMIN || role === UserRole.OWNER;
          audienceViewerRef.current = { ...audienceViewerRef.current, isAdmin };
          setCanViewProcessing(true);
          setCanMutateProcessing(isAdmin);
        }
        // The personal preference is read once per signed-in identity.
        const identity = authenticatedIdentityRef.current;
        if (!cancelled && identity && preferencesIdentityRef.current !== identity) {
          preferencesIdentityRef.current = identity;
          const notifyAutomaticRuns = await loadNotifyAutomaticRuns();
          if (!cancelled && authenticatedIdentityRef.current === identity) {
            audienceViewerRef.current = { ...audienceViewerRef.current, notifyAutomaticRuns };
          }
        }
        // A named binding: the test Babel setup cannot compile `catch {}` in async code.
      } catch (error: unknown) {
        if (!cancelled) {
          authenticatedIdentityRef.current = null;
          preferencesIdentityRef.current = null;
          audienceViewerRef.current = DEFAULT_NOTIFICATION_AUDIENCE_VIEWER;
          setStudyProcessingAuthIdentity(null);
          clearStudyProcessingState();
          setCanViewProcessing(false);
          setCanMutateProcessing(false);
          clearNotificationState();
        }
      }
    }

    resolveAuth();

    return () => {
      cancelled = true;
    };
  }, [clearNotificationState, clearStudyProcessingState, pathname]);

  useEffect(() => {
    // The Settings toggle applies to this browser at once.
    const handlePreferencesChanged = (event: Event) => {
      const detail = (event as CustomEvent<NotificationPreferencesChangedDetail>).detail;
      if (typeof detail?.notifyAutomaticRuns === 'boolean') {
        audienceViewerRef.current = {
          ...audienceViewerRef.current,
          notifyAutomaticRuns: detail.notifyAutomaticRuns,
        };
      }
    };
    window.addEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, handlePreferencesChanged);
    return () =>
      window.removeEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, handlePreferencesChanged);
  }, []);

  const handleTransition = useCallback(
    (event: ProcessingTransitionEvent) => {
      if (!shouldRaiseCandidatePollNotification(audienceViewerRef.current)) {
        return;
      }
      addNotification(
        createCandidatePollInferenceNotification(event, Date.now(), isBellOpenRef.current)
      );
    },
    [addNotification]
  );

  const handleStudyProcessingNotificationTransition = useCallback(
    (transition: StudyProcessingNotificationTransition) => {
      // Only the notification is filtered: the status was already applied.
      if (!shouldRaiseStudyProcessingNotification(transition, audienceViewerRef.current)) {
        return;
      }
      addNotification(
        createStudyEventInferenceNotification(
          transition,
          visibleStudyMetadataRef.current.get(transition.summary.studyInstanceUID),
          Date.now(),
          isBellOpenRef.current
        )
      );
    },
    [addNotification]
  );

  const processingAvailability = getStudyProcessingFeatureAvailability(
    canViewProcessing,
    resolveStudyProcessingFeatureFlags(),
    canMutateProcessing
  );

  useEffect(() => {
    if (!processingAvailability.canUseCandidateNotificationFallback) {
      candidateFallbackActiveRef.current = false;
      return;
    }

    if (!candidateFallbackActiveRef.current) {
      studyProcessingRolloutTelemetry.recordCandidateFallbackActivation(
        processingAvailability.canUseRealtimeSSE
          ? 'live_notifications_disabled'
          : 'realtime_unavailable'
      );
      candidateFallbackActiveRef.current = true;
    }
  }, [
    processingAvailability.canUseCandidateNotificationFallback,
    processingAvailability.canUseRealtimeSSE,
  ]);

  useEffect(() => {
    if (processingAvailability.canViewProcessing) {
      return;
    }

    clearStudyProcessingState();
    clearNotificationState();
  }, [clearNotificationState, clearStudyProcessingState, processingAvailability.canViewProcessing]);

  useCandidateProcessingPoll({
    onTransition: handleTransition,
    enabled: processingAvailability.canUseCandidateNotificationFallback,
  });

  const markAllRead = useCallback(() => {
    setNotifications(markAllInferenceNotificationsRead);
  }, []);

  const unreadCount = notifications.filter(item => !item.read).length;

  return (
    <InferenceProcessingContext.Provider
      value={{
        notifications,
        unreadCount,
        canShowBell:
          processingAvailability.canUseStudyEventNotifications ||
          processingAvailability.canUseCandidateNotificationFallback,
        canReprocessStudy: processingAvailability.canReprocessStudy,
        canUseStudyProcessingFixtures: processingAvailability.canUseFixturePreview,
        canUseStudyProcessingREST: processingAvailability.canUseRESTSnapshots,
        canViewStudyProcessing: processingAvailability.canViewProcessing,
        canViewStudyProcessingRunHistory: processingAvailability.canViewRunHistory,
        canUseStudyProcessingRealtime: processingAvailability.canUseRealtimeSSE,
        studyProcessingAuthIdentity,
        handleStudyProcessingNotificationTransition,
        setVisibleStudyNotificationMetadata,
        markAllRead,
        isBellOpen,
        setBellOpen,
      }}
    >
      {children}
    </InferenceProcessingContext.Provider>
  );
}

export default InferenceProcessingProvider;
