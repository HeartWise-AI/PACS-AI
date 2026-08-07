import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useNotification } from '@ohif/ui-next';
import userRepository from '../../api/userRepository';
import { UserRole } from '../../api/userDTO';
import {
  useCandidateProcessingPoll,
  ProcessingTransitionEvent,
} from '../../hooks/useCandidateProcessingPoll';
import { useStudyProcessing } from './studyProcessing/StudyProcessingProvider';
import {
  getStudyProcessingAuthIdentity,
  shouldClearStudyProcessingState,
} from './studyProcessing/authIdentity';
import { getStudyProcessingFeatureAvailability } from './studyProcessing/featureFlags';
import type { StudyProcessingNotificationTransition } from './studyProcessing';
import {
  addRecentInferenceNotification,
  createCandidatePollInferenceNotification,
  createStudyEventInferenceNotification,
  getInferenceNotificationPresentation,
  type InferenceNotification,
  type StudyNotificationWorklistMetadata,
} from './inferenceNotifications';

const RECENT_LIMIT = 20;

type InferenceProcessingContextValue = {
  notifications: InferenceNotification[];
  unreadCount: number;
  canShowBell: boolean;
  canViewStudyProcessing: boolean;
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

function InferenceProcessingProvider({ children }) {
  const { t } = useTranslation('StudyList');
  const { show } = useNotification();
  const location = useLocation();
  const [notifications, setNotifications] = useState<InferenceNotification[]>([]);
  const [hasProcessingRole, setHasProcessingRole] = useState(false);
  const [studyProcessingAuthIdentity, setStudyProcessingAuthIdentity] = useState<string | null>(
    null
  );
  const [isBellOpen, setBellOpen] = useState(false);
  const isBellOpenRef = useRef(false);
  const authenticatedIdentityRef = useRef<string | null>(null);
  const notificationDeduplicationKeysRef = useRef(new Set<string>());
  const visibleStudyMetadataRef = useRef(new Map<string, StudyNotificationWorklistMetadata>());
  const { clearStudyProcessingState } = useStudyProcessing();

  isBellOpenRef.current = isBellOpen;

  const clearNotificationState = useCallback(() => {
    notificationDeduplicationKeysRef.current = new Set();
    visibleStudyMetadataRef.current = new Map();
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
    (notification: InferenceNotification) => {
      if (notificationDeduplicationKeysRef.current.has(notification.deduplicationKey)) {
        return;
      }

      notificationDeduplicationKeysRef.current.add(notification.deduplicationKey);
      const presentation = getInferenceNotificationPresentation(notification);
      const patientLabel = notification.patientName ?? t('ProcessingNotificationUnknownStudy');
      const modalityLabel =
        notification.modalitiesInStudy ?? t('ProcessingNotificationUnknownModality');

      show({
        type: presentation.tone,
        title: t(presentation.titleKey),
        message: `${patientLabel} · ${modalityLabel}`,
        id: notification.deduplicationKey,
      });

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
          setStudyProcessingAuthIdentity(null);
          clearStudyProcessingState();
          setHasProcessingRole(false);
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
          const nextHasProcessingRole = role === UserRole.ADMIN || role === UserRole.OWNER;
          setHasProcessingRole(nextHasProcessingRole);
          if (!nextHasProcessingRole) {
            clearNotificationState();
          }
        }
      } catch {
        if (!cancelled) {
          authenticatedIdentityRef.current = null;
          setStudyProcessingAuthIdentity(null);
          clearStudyProcessingState();
          setHasProcessingRole(false);
          clearNotificationState();
        }
      }
    }

    resolveAuth();

    return () => {
      cancelled = true;
    };
  }, [clearNotificationState, clearStudyProcessingState, location.pathname]);

  const handleTransition = useCallback(
    (event: ProcessingTransitionEvent) => {
      addNotification(
        createCandidatePollInferenceNotification(event, Date.now(), isBellOpenRef.current)
      );
    },
    [addNotification]
  );

  const handleStudyProcessingNotificationTransition = useCallback(
    (transition: StudyProcessingNotificationTransition) => {
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

  const processingAvailability = getStudyProcessingFeatureAvailability(hasProcessingRole);

  useCandidateProcessingPoll({
    onTransition: handleTransition,
    enabled: processingAvailability.canUseCandidateNotificationFallback,
  });

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(item => ({ ...item, read: true })));
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
        canViewStudyProcessing: processingAvailability.canViewProcessing,
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

InferenceProcessingProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default InferenceProcessingProvider;
