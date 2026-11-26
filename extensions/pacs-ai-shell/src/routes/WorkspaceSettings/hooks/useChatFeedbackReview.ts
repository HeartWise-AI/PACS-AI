import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertContext } from '../../../alerts';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import type {
  ChatFeedbackCountsResponse,
  ChatFeedbackItem,
  ChatFeedbackVote,
} from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import { handleUnauthorizedAccess } from '../utils';
import { useAuthenticatedScope } from './authenticatedScope';

export const CHAT_FEEDBACK_PAGE_SIZE = 50;
// The gateway returns at most 200 votes per request.
export const CHAT_FEEDBACK_MAX_ITEMS = 200;

export interface ChatFeedbackQuery {
  days: number;
  rating: ChatFeedbackVote | '';
  study: string;
}

export type ChatFeedbackLoadError = 'not_configured' | 'failed' | null;

export interface UseChatFeedbackReviewResult {
  items: ChatFeedbackItem[];
  total: number;
  counts: ChatFeedbackCountsResponse | null;
  loading: boolean;
  error: ChatFeedbackLoadError;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

function errorKind(failure: unknown): ChatFeedbackLoadError {
  const code = (failure as { errorCode?: unknown } | null)?.errorCode;
  return code === 'chat_feedback_not_configured' ? 'not_configured' : 'failed';
}

/**
 * The workspace's votes on chat answers for the admin tab (PACS-448). Loads
 * only while the tab is active, again when the query changes, and on refresh.
 */
export function useChatFeedbackReview({
  active,
  query,
}: {
  active: boolean;
  query: ChatFeedbackQuery;
}): UseChatFeedbackReviewResult {
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const { tenantId } = useAuthenticatedScope();
  const [items, setItems] = useState<ChatFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<ChatFeedbackCountsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatFeedbackLoadError>(null);
  const [pages, setPages] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);
  const { days, rating, study } = query;

  // A new query starts again from the first page.
  useEffect(() => setPages(1), [days, rating, study]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const requestId = ++requestRef.current;
    const studyFilter = study.trim();
    const common = { days, ...(studyFilter ? { study: studyFilter } : {}) };
    setLoading(true);
    setError(null);
    Promise.all([
      orchestratorRepository.ListChatFeedback({
        ...common,
        ...(rating ? { rating } : {}),
        limit: Math.min(CHAT_FEEDBACK_PAGE_SIZE * pages, CHAT_FEEDBACK_MAX_ITEMS),
        offset: 0,
      }),
      orchestratorRepository.CountChatFeedback(common),
    ])
      .then(([list, summary]) => {
        if (requestId !== requestRef.current) {
          return;
        }
        setItems(list?.data?.items ?? []);
        setTotal(list?.data?.total ?? 0);
        setCounts(summary?.data ?? null);
      })
      .catch(failure => {
        if (requestId !== requestRef.current) {
          return;
        }
        handleUnauthorizedAccess(failure ?? {}, showAlert, navigate, tenantId);
        console.error('Error fetching chat feedback:', failure);
        setError(errorKind(failure));
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showAlert from AlertContext is unstable
  }, [active, days, rating, study, pages, reloadKey, tenantId]);

  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    []
  );

  const refresh = useCallback(() => setReloadKey(key => key + 1), []);
  const loadMore = useCallback(() => setPages(n => n + 1), []);

  return {
    items,
    total,
    counts,
    loading,
    error,
    hasMore: items.length < total && items.length < CHAT_FEEDBACK_MAX_ITEMS,
    loadMore,
    refresh,
  };
}
