import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatThreadSummary } from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import { threadTime } from '../utils/chatHistory';

interface ChatHistoryPanelProps {
  threads: ChatThreadSummary[];
  currentThreadId: string | null;
  loading: boolean;
  disabled: boolean;
  onSelect: (threadId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

function formatWhen(date: Date, locale: string): string {
  if (date.getTime() === 0) {
    return '';
  }
  try {
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toLocaleString();
  }
}

/** The signed-in user's earlier chats about the open study; pick one to continue it. */
export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  threads,
  currentThreadId,
  loading,
  disabled,
  onSelect,
  onNewChat,
  onClose,
}) => {
  const { t, i18n } = useTranslation('ChatBox');

  return (
    <div
      className="chat-history-panel border-b border-white/10 bg-[#161917] px-3 py-2 text-sm"
      role="dialog"
      aria-label={t('HistoryTitle')}
      data-cy="chat-history-panel"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-white/80">{t('HistoryTitle')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded bg-[rgba(100,180,100,0.7)] px-2 py-0.5 text-xs text-white hover:bg-[rgba(100,180,100,0.9)] disabled:opacity-50"
            onClick={onNewChat}
            disabled={disabled}
            data-cy="chat-history-new"
          >
            {t('NewChat')}
          </button>
          <button
            type="button"
            className="text-white/60 hover:text-white"
            onClick={onClose}
            aria-label={t('CitationClose')}
            title={t('CitationClose')}
          >
            ×
          </button>
        </div>
      </div>
      {loading && <p className="text-xs text-white/60">{t('HistoryLoading')}</p>}
      {!loading && threads.length === 0 && (
        <p className="text-xs text-white/60">{t('HistoryEmpty')}</p>
      )}
      {threads.length > 0 && (
        <ul
          className="max-h-48 space-y-1 overflow-y-auto"
          data-cy="chat-history-list"
        >
          {threads.map(thread => {
            const current = thread.thread_id === currentThreadId;
            return (
              <li key={thread.thread_id}>
                <button
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 ${
                    current ? 'bg-white/10 ring-1 ring-[#C8F469]/60' : ''
                  }`}
                  onClick={() => !current && onSelect(thread.thread_id)}
                  disabled={disabled}
                  aria-current={current ? 'true' : undefined}
                  data-cy="chat-history-item"
                >
                  <span className="block truncate text-white">{thread.title || t('NewChat')}</span>
                  <span className="block text-xs text-white/50">
                    {formatWhen(threadTime(thread), i18n.language)}
                    {' · '}
                    {thread.message_count === 1
                      ? t('HistoryOneMessage')
                      : t('HistoryMessages', { count: thread.message_count })}
                    {current ? ` · ${t('HistoryCurrent')}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
