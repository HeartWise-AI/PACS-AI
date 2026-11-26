import type {
  ChatThreadHistory,
  ChatThreadSummary,
} from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import type { ChatFeedbackEntry } from '../hooks/useChatFeedback';
import type { Message } from '../types';
import { toCitations } from './citations';

// Reason saved with a thumb before the clinician picks one (see useChatFeedback).
const DEFAULT_CATEGORY = 'other';

/**
 * A chat-service time as a Date. The service stores naive local times (no
 * zone), which the browser reads as its own local time; a time with a zone
 * is kept as is. Unparsable or missing values give the epoch, never "now".
 */
export function parseServerTime(value?: string | null): Date {
  if (!value) {
    return new Date(0);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

/** The stored messages of a thread, as the chat box shows them. */
export function historyToMessages(history: ChatThreadHistory): Message[] {
  const threadId = history.thread_id;
  return (history.messages || [])
    .filter(message => message && typeof message.content === 'string' && message.message_id)
    .map(message => {
      const isAssistant = message.role === 'assistant';
      const citations = isAssistant ? toCitations(message.citations) : undefined;
      return {
        id: message.message_id,
        text: isAssistant ? message.content.trim() : message.content,
        sender: isAssistant ? 'assistant' : 'user',
        timestamp: parseServerTime(message.created_at),
        status: 'sent',
        ...(isAssistant ? { backendMessageId: message.message_id, backendThreadId: threadId } : {}),
        ...(citations?.length ? { citations } : {}),
      } as Message;
    });
}

/**
 * The signed-in user's votes on a thread, keyed like the chat box keys them
 * (a restored answer's id is its stored id). A thumbs down whose reason was
 * given (a category other than the default, or a comment) does not ask again.
 */
export function historyToFeedback(history: ChatThreadHistory): Record<string, ChatFeedbackEntry> {
  const entries: Record<string, ChatFeedbackEntry> = {};
  for (const vote of history.feedback || []) {
    if (!vote || !vote.message_id || (vote.vote !== 'up' && vote.vote !== 'down')) {
      continue;
    }
    entries[vote.message_id] = {
      vote: vote.vote,
      category: vote.category,
      status: 'saved',
      detailsSaved: vote.vote === 'up' || vote.has_comment || vote.category !== DEFAULT_CATEGORY,
    };
  }
  return entries;
}

/** When a thread was last active, for the history list. */
export function threadTime(thread: ChatThreadSummary): Date {
  return parseServerTime(thread.last_message_at || thread.updated_at || thread.created_at);
}
