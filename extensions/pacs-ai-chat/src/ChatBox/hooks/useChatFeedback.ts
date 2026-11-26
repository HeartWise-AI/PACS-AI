import { useCallback, useRef, useState } from 'react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import type { ChatFeedbackVote } from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import type { Message } from '../types';

/** Reason saved with a thumb before the clinician picks one. */
export const DEFAULT_CHAT_FEEDBACK_CATEGORY = 'other';

export type ChatFeedbackStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ChatFeedbackEntry {
  vote: ChatFeedbackVote | null;
  category?: string;
  comment?: string;
  status: ChatFeedbackStatus;
  // True once a thumbs down has a reason or comment the clinician confirmed.
  detailsSaved?: boolean;
}

export interface UseChatFeedbackResult {
  feedback: Record<string, ChatFeedbackEntry>;
  /** Click on a thumb: set it, or remove it when it was already set. */
  toggle: (message: Message, vote: ChatFeedbackVote) => Promise<void>;
  /** Save a reason and an optional comment with the current vote. */
  saveDetails: (message: Message, category: string, comment: string) => Promise<void>;
  reset: () => void;
  /** Show the votes stored with a restored thread. */
  restore: (entries: Record<string, ChatFeedbackEntry>) => void;
}

/**
 * Thumbs up/down on chat answers, saved in the chat backend through the
 * gateway (PACS-448). Answers without a stored id (older backend) keep the
 * thumb locally only.
 */
export function useChatFeedback(threadId: string | null | undefined): UseChatFeedbackResult {
  const [feedback, setFeedback] = useState<Record<string, ChatFeedbackEntry>>({});
  const latest = useRef(feedback);
  latest.current = feedback;

  const update = useCallback((id: string, entry: ChatFeedbackEntry) => {
    setFeedback(prev => ({ ...prev, [id]: entry }));
  }, []);

  const toggle = useCallback(
    async (message: Message, vote: ChatFeedbackVote) => {
      const previous = latest.current[message.id] ?? { vote: null, status: 'idle' as const };
      const next = previous.vote === vote ? null : vote;
      const target = message.backendMessageId;
      const thread = message.backendThreadId || threadId;
      if (!target || !thread) {
        update(message.id, { vote: next, status: 'idle' });
        return;
      }
      update(message.id, { vote: next, status: 'saving' });
      try {
        if (next) {
          await orchestratorRepository.SubmitChatFeedback({
            threadId: thread,
            messageId: target,
            vote: next,
            category: DEFAULT_CHAT_FEEDBACK_CATEGORY,
          });
          update(message.id, {
            vote: next,
            category: DEFAULT_CHAT_FEEDBACK_CATEGORY,
            status: 'saved',
          });
        } else {
          await orchestratorRepository.RemoveChatFeedback({ threadId: thread, messageId: target });
          update(message.id, { vote: null, status: 'idle' });
        }
      } catch (error) {
        console.error('Could not save the chat feedback:', error);
        update(message.id, { ...previous, status: 'error' });
      }
    },
    [threadId, update]
  );

  const saveDetails = useCallback(
    async (message: Message, category: string, comment: string) => {
      const current = latest.current[message.id];
      const target = message.backendMessageId;
      const thread = message.backendThreadId || threadId;
      if (!current?.vote || !target || !thread) {
        return;
      }
      const trimmed = comment.trim();
      update(message.id, { ...current, status: 'saving' });
      try {
        await orchestratorRepository.SubmitChatFeedback({
          threadId: thread,
          messageId: target,
          vote: current.vote,
          category,
          ...(trimmed ? { comment: trimmed } : {}),
        });
        update(message.id, {
          vote: current.vote,
          category,
          comment: trimmed,
          status: 'saved',
          detailsSaved: true,
        });
      } catch (error) {
        console.error('Could not save the chat feedback reason:', error);
        update(message.id, { ...current, status: 'error' });
      }
    },
    [threadId, update]
  );

  const reset = useCallback(() => setFeedback({}), []);
  const restore = useCallback(
    (entries: Record<string, ChatFeedbackEntry>) => setFeedback({ ...entries }),
    []
  );

  return { feedback, toggle, saveDetails, reset, restore };
}
