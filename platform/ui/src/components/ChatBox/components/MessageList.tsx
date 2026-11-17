import React, { useRef, useEffect } from 'react';
import type { ChatActivity, Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  errorDetails: string;
  // Live steps of the message in flight, shown in the thinking bubble.
  progress?: ChatActivity | null;
  onRetry: () => void;
  messageFeedback: Record<string, 'up' | 'down' | null>;
  onFeedback: (messageId: string, type: 'up' | 'down') => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  errorDetails,
  progress = null,
  onRetry,
  messageFeedback,
  onFeedback,
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
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
