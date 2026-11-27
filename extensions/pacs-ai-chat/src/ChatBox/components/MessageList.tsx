import React, { useRef, useEffect } from 'react';
import type { ChatActivity, Message } from '../types';
import type { ChatFeedbackEntry } from '../hooks/useChatFeedback';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  errorDetails: string;
  // Live steps of the message in flight, shown in the thinking bubble.
  progress?: ChatActivity | null;
  onRetry: () => void;
  messageFeedback: Record<string, ChatFeedbackEntry>;
  onFeedback: (message: Message, type: 'up' | 'down') => void;
  onFeedbackDetails?: (message: Message, category: string, comment: string) => void;
  // Sends the question of a failed answer again; absent while the chat is busy.
  onRetryMessage?: (question: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  errorDetails,
  progress = null,
  onRetry,
  messageFeedback,
  onFeedback,
  onFeedbackDetails,
  onRetryMessage,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, progress?.steps.length]);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {messages.length === 0 ? (
        <EmptyState
          isLoading={isLoading}
          errorDetails={errorDetails}
          onRetry={onRetry}
        />
      ) : (
        messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            progress={message.isThinking ? progress : null}
            feedback={messageFeedback[message.id]}
            onFeedback={onFeedback}
            onFeedbackDetails={onFeedbackDetails}
            onRetryMessage={onRetryMessage}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
