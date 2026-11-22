import React from 'react';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  isLoading: boolean;
  errorDetails: string;
  onRetry: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ isLoading, errorDetails, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
      <svg
        className="mb-4 h-12 w-12"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
      <p>{t('No messages yet')}</p>
      <p className="mt-2 text-sm">
        {t(
          'Click the "+" button to select series, or start a conversation to get assistance with your medical images.'
        )}
      </p>
      {errorDetails && (
        <div className="mt-4 max-w-full rounded-lg border border-red-500 border-opacity-30 bg-red-900 bg-opacity-30 p-3 text-red-400">
          <p className="font-medium">{t('Error initializing chat:')}</p>
          <p className="mt-1 break-words text-sm">{errorDetails}</p>
          <div className="mt-3 space-y-2">
            <button
              onClick={onRetry}
              className="rounded-md bg-[rgba(100,180,100,0.7)] px-3 py-1 text-white transition-colors hover:bg-[rgba(100,180,100,0.9)]"
            >
              {t('Retry')}
            </button>
            <p className="mt-1 text-xs text-gray-500">
              {t('If the error persists, please check your network connection or contact support.')}
            </p>
          </div>
        </div>
      )}
      {isLoading && !errorDetails && (
        <div className="mt-4 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-white"></div>
          <span className="ml-2 text-sm">{t('Initializing chat...')}</span>
        </div>
      )}
    </div>
  );
};
