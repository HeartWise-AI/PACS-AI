import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
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

const RECENT_LIMIT = 20;

export type InferenceNotification = ProcessingTransitionEvent & {
  seenAt: number;
  read: boolean;
};

type InferenceProcessingContextValue = {
  notifications: InferenceNotification[];
  unreadCount: number;
  canShowBell: boolean;
  canViewStudyProcessing: boolean;
  studyProcessingAuthIdentity: string | null;
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
  const { show } = useNotification();
  const location = useLocation();
  const [notifications, setNotifications] = useState<InferenceNotification[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [studyProcessingAuthIdentity, setStudyProcessingAuthIdentity] = useState<string | null>(
    null
  );
  const [isBellOpen, setBellOpen] = useState(false);
  const isBellOpenRef = useRef(false);
  const authenticatedIdentityRef = useRef<string | null>(null);
  const { clearStudyProcessingState } = useStudyProcessing();

  isBellOpenRef.current = isBellOpen;

  useEffect(() => {
    let cancelled = false;

    async function resolveAuth() {
      const token = localStorage.getItem('sessionToken');
      if (!token) {
        if (!cancelled) {
          authenticatedIdentityRef.current = null;
          setStudyProcessingAuthIdentity(null);
          clearStudyProcessingState();
          setPollEnabled(false);
          setNotifications([]);
        }
        return;
      }

      try {
        const response = await userRepository.GetCurrentUser();
        if (!cancelled) {
          const nextIdentity = getStudyProcessingAuthIdentity(response.data);
          if (shouldClearStudyProcessingState(authenticatedIdentityRef.current, nextIdentity)) {
            clearStudyProcessingState();
          }
          authenticatedIdentityRef.current = nextIdentity;
          setStudyProcessingAuthIdentity(nextIdentity);

          const role = response.data.role;
          const canPoll = role === UserRole.ADMIN || role === UserRole.OWNER;
          setPollEnabled(canPoll);
          if (!canPoll) {
            setNotifications([]);
          }
        }
      } catch {
        if (!cancelled) {
          authenticatedIdentityRef.current = null;
          setStudyProcessingAuthIdentity(null);
          clearStudyProcessingState();
          setPollEnabled(false);
          setNotifications([]);
        }
      }
    }

    resolveAuth();

    return () => {
      cancelled = true;
    };
  }, [clearStudyProcessingState, location.pathname]);

  const handleTransition = useCallback(
    (event: ProcessingTransitionEvent) => {
      const isFailure = event.processingStatus === 'failed';
      const isPartial = event.processingStatus === 'partial';

      show({
        type: isFailure ? 'error' : 'success',
        title: isFailure
          ? 'Inference failed'
          : isPartial
            ? 'Inference partially completed'
            : 'Inference completed',
        message: `${event.patientId} · ${event.modalitiesInStudy}`,
        id: `${event.candidateId}-${event.processingStatusAt}`,
      });

      setNotifications(prev => {
        const next: InferenceNotification[] = [
          { ...event, seenAt: Date.now(), read: isBellOpenRef.current },
          ...prev.filter(item => item.candidateId !== event.candidateId),
        ];
        return next.slice(0, RECENT_LIMIT);
      });
    },
    [show]
  );

  useCandidateProcessingPoll({
    onTransition: handleTransition,
    enabled: pollEnabled,
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
        canShowBell: pollEnabled,
        canViewStudyProcessing: pollEnabled,
        studyProcessingAuthIdentity,
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
