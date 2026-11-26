import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_FEEDBACK_CATEGORIES } from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import type { ChatFeedbackEntry } from '../hooks/useChatFeedback';

interface FeedbackReasonFormProps {
  entry: ChatFeedbackEntry;
  onSave: (category: string, comment: string) => void;
}

/** After a thumbs down: what was wrong, and an optional comment. */
export const FeedbackReasonForm: React.FC<FeedbackReasonFormProps> = ({ entry, onSave }) => {
  const { t } = useTranslation('ChatBox');
  const [category, setCategory] = useState(entry.category ?? 'other');
  const [comment, setComment] = useState(entry.comment ?? '');
  const saving = entry.status === 'saving';

  if (entry.detailsSaved && entry.status !== 'error') {
    return (
      <p
        className="mt-2 text-xs text-white/60"
        role="status"
      >
        {t('FeedbackThanks')}
      </p>
    );
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-md border border-white/10 bg-black/20 p-2 text-xs"
      aria-label={t('FeedbackWhatWasWrong')}
      onSubmit={event => {
        event.preventDefault();
        onSave(category, comment);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-white/70">{t('FeedbackWhatWasWrong')}</span>
        <select
          className="border-white/15 rounded border bg-[#1B1F1B] px-2 py-1 text-white"
          value={category}
          onChange={event => setCategory(event.target.value)}
        >
          {CHAT_FEEDBACK_CATEGORIES.down.map(id => (
            <option
              key={id}
              value={id}
            >
              {t(`FeedbackReason_${id}`)}
            </option>
          ))}
        </select>
      </label>
      <textarea
        className="border-white/15 min-h-[48px] rounded border bg-[#1B1F1B] px-2 py-1 text-white"
        placeholder={t('FeedbackCommentPlaceholder')}
        aria-label={t('FeedbackCommentPlaceholder')}
        maxLength={5000}
        value={comment}
        onChange={event => setComment(event.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-white/50">
          {entry.status === 'error'
            ? t('FeedbackSaveError')
            : entry.status === 'saving'
              ? t('FeedbackSaving')
              : t('FeedbackSaved')}
        </span>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[#C8F469] px-3 py-1 font-semibold text-[#0E120E] disabled:opacity-50"
        >
          {t('FeedbackSend')}
        </button>
      </div>
    </form>
  );
};
