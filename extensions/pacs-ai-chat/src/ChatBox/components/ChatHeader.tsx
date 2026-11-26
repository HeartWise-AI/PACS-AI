import React from 'react';
import { useTranslation } from 'react-i18next';

interface ChatHeaderProps {
  onAddSeries: () => void;
  // Starts a new chat; earlier chats stay stored and listed under the history button.
  onClearChat: () => void;
  onClose: () => void;
  // Shows the earlier chats of the open study; no button without it.
  onToggleHistory?: () => void;
  historyOpen?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onAddSeries,
  onClearChat,
  onClose,
  onToggleHistory,
  historyOpen = false,
}) => {
  const { t } = useTranslation();
  const { t: tChat } = useTranslation('ChatBox');

  return (
    <div
      className="draggable-header flex items-center justify-between rounded-t-lg border-b border-white border-opacity-10 bg-gradient-to-r from-[rgba(100,200,100,0.8)] to-[rgba(200,244,105,0.8)] px-4 py-3"
      style={{ cursor: 'grab' }}
    >
      <h2 className="pl-6 text-lg font-bold text-white">{t('Chat')}</h2>
      <div className="flex space-x-2">
        {/* Add Series button */}
        <button
          onClick={onAddSeries}
          className="flex items-center text-white hover:text-gray-300 focus:outline-none"
          aria-label="Add Series"
          title={t('Add Series')}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
        {/* Earlier chats of this study */}
        {onToggleHistory && (
          <button
            onClick={onToggleHistory}
            className={`text-white hover:text-gray-300 focus:outline-none ${historyOpen ? 'opacity-100' : ''}`}
            aria-label={tChat('HistoryButton')}
            aria-expanded={historyOpen}
            title={tChat('HistoryButton')}
            data-cy="chat-history-button"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        )}
        {/* New chat (earlier chats stay stored) */}
        <button
          onClick={onClearChat}
          className="text-white hover:text-gray-300 focus:outline-none"
          aria-label={tChat('NewChat')}
          title={tChat('NewChat')}
          data-cy="chat-new-button"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        {/* Close button */}
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 focus:outline-none"
          aria-label="Close chat"
          title={t('Close chat')}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
