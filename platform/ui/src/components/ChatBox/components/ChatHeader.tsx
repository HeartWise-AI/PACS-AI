import React from 'react';
import { useTranslation } from 'react-i18next';

interface ChatHeaderProps {
  onAddSeries: () => void;
  onClearChat: () => void;
  onClose: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onAddSeries, onClearChat, onClose }) => {
  const { t } = useTranslation();

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
        {/* Clear chat button */}
        <button
          onClick={onClearChat}
          className="text-white hover:text-gray-300 focus:outline-none"
          aria-label="Clear chat"
          title={t('Clear chat history')}
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
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
