import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ChatBox from '../ChatBox';

// Import the Message interface from ChatBox
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatButtonProps {
  servicesManager: any;
}

const ChatButton: React.FC<ChatButtonProps> = ({
  servicesManager,
}) => {
  const { t } = useTranslation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [viewportChangeCounter, setViewportChangeCounter] = useState(0);
  // Add state for chat messages
  const [messages, setMessages] = useState<Message[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Listen for viewport changes to update the series information
  useEffect(() => {
    if (!servicesManager?.services) {
      console.warn('servicesManager or services not available for viewport tracking');
      return;
    }

    const { viewportGridService, displaySetService } = servicesManager.services;

    if (!viewportGridService) {
      console.warn('viewportGridService not available for viewport tracking');
      return;
    }

    // Track viewport changes for active viewport
    let unsubscribeViewport: () => void;
    try {
      const viewportSubscription = viewportGridService.subscribe(
        viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
        () => {
          console.log('Viewport change detected');
          setViewportChangeCounter(prev => prev + 1);
        }
      );
      unsubscribeViewport = viewportSubscription.unsubscribe;
    } catch (error) {
      console.error('Failed to subscribe to viewport changes:', error);
    }

    // Track display set changes (for when staying in the same viewport but content changes)
    let unsubscribeDisplaySet: () => void;
    if (displaySetService && displaySetService.EVENTS && displaySetService.subscribe) {
      try {
        const displaySetSubscription = displaySetService.subscribe(
          displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
          () => {
            console.log('Display set change detected');
            setViewportChangeCounter(prev => prev + 1);
          }
        );
        unsubscribeDisplaySet = displaySetSubscription.unsubscribe;
      } catch (error) {
        console.error('Failed to subscribe to display set changes:', error);
      }
    }

    // Clean up subscriptions
    return () => {
      if (unsubscribeViewport) unsubscribeViewport();
      if (unsubscribeDisplaySet) unsubscribeDisplaySet();
    };
  }, [servicesManager]);

  // Handle keyboard shortcut to toggle chat (Ctrl+/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setIsChatOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleChat = () => {
    // Force a refresh of series info when opening
    if (!isChatOpen) {
      setViewportChangeCounter(prev => prev + 1);
    }
    setIsChatOpen(prev => !prev);
  };

  // Handle clearing chat messages
  const handleClearChat = () => {
    setMessages([]);
  };

  // Handle adding new messages
  const handleAddMessage = (newMessages: Message[]) => {
    setMessages(newMessages);
  };

  return (
    <>
      <button
        ref={buttonRef}
        className="relative overflow-hidden rounded-lg p-1 bg-gradient-to-r from-[rgba(40,120,255,1)] to-[rgba(0,210,255,1)] flex items-center gap-1"
        type="button"
        onClick={toggleChat}
        title={t('Toggle Chat (Ctrl+/)')}
      >
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </button>

      <ChatBox
        key={`chat-box-${viewportChangeCounter}`}
        isOpen={isChatOpen}
        onClose={toggleChat}
        servicesManager={servicesManager}
        messages={messages}
        onMessagesChange={handleAddMessage}
        onClearChat={handleClearChat}
      />
    </>
  );
};

ChatButton.propTypes = {
  servicesManager: PropTypes.object.isRequired,
};

export default ChatButton;
