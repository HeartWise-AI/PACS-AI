import React from 'react';
import type { Message } from '../types';
import { parseMarkdown } from '../utils/markdown';
import { ThinkingIndicator } from './ThinkingIndicator';

interface MessageBubbleProps {
  message: Message;
  feedback?: 'up' | 'down' | null;
  onFeedback?: (messageId: string, type: 'up' | 'down') => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, feedback, onFeedback }) => {
  const isUser = message.sender === 'user';
  const isAssistant = message.sender === 'assistant';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-gradient-to-r from-[rgba(100,180,100,0.7)] to-[rgba(180,230,100,0.7)] text-white'
            : 'bg-[#333633] text-white'
        }`}
      >
        <div className="whitespace-pre-wrap text-sm">
          {message.isThinking ? (
            <ThinkingIndicator />
          ) : (
            <div
              className="markdown-content"
              dangerouslySetInnerHTML={{
                __html: parseMarkdown(message.text?.trim() || ''),
              }}
            />
          )}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs opacity-70">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isAssistant && !message.isThinking && onFeedback && (
            <div className="flex gap-2 text-gray-400">
              <button
                onClick={() => onFeedback(message.id, 'up')}
                className={`transition-colors ${
                  feedback === 'up' ? 'text-green-500' : 'hover:text-green-400'
                }`}
                aria-label="Thumbs up"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                  />
                </svg>
              </button>
              <button
                onClick={() => onFeedback(message.id, 'down')}
                className={`transition-colors ${
                  feedback === 'down' ? 'text-red-500' : 'hover:text-red-400'
                }`}
                aria-label="Thumbs down"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.017c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
