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
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);
  const { days, rating, study } = query;

  const filters = useCallback(() => {
    const studyFilter = study.trim();
    return { days, ...(studyFilter ? { study: studyFilter } : {}) };
  }, [days, study]);

  // Latest alert and navigation, read when a request fails; not effect dependencies, since
  // AlertContext and useNavigate may return new values on every render.
  const onFailure = useRef<(failure: unknown) => void>(() => undefined);
  onFailure.current = (failure: unknown) => {
    handleUnauthorizedAccess(failure ?? {}, showAlert, navigate, tenantId);
    console.error('Error fetching chat feedback:', failure);
    setError(errorKind(failure));
  };
  const fail = useCallback((failure: unknown) => onFailure.current(failure), []);

  // First page and counts, again whenever the query changes or on refresh.
  useEffect(() => {
    if (!active) {
      return;
    }
    const requestId = ++requestRef.current;
    const common = filters();
    setLoading(true);
    setError(null);
    Promise.all([
      orchestratorRepository.ListChatFeedback({
        ...common,
        ...(rating ? { rating } : {}),
        limit: CHAT_FEEDBACK_PAGE_SIZE,
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
        if (requestId === requestRef.current) {
          fail(failure);
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      });
  }, [active, filters, rating, reloadKey, fail]);

  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    []
  );

  const refresh = useCallback(() => setReloadKey(key => key + 1), []);

  // The next page, appended to the votes already shown.
  const loadMore = useCallback(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    orchestratorRepository
      .ListChatFeedback({
        ...filters(),
        ...(rating ? { rating } : {}),
        limit: CHAT_FEEDBACK_PAGE_SIZE,
        offset: items.length,
      })
      .then(list => {
        if (requestId !== requestRef.current) {
          return;
        }
        const seen = new Set(items.map(item => item.feedback_id));
        setItems([
          ...items,
          ...(list?.data?.items ?? []).filter(item => !seen.has(item.feedback_id)),
        ]);
        setTotal(list?.data?.total ?? 0);
      })
      .catch(failure => {
        if (requestId === requestRef.current) {
          fail(failure);
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      });
  }, [filters, rating, items, fail]);

  return {
    items,
    total,
    counts,
    loading,
    error,
    hasMore: items.length < total,
    loadMore,
    refresh,
  };
}
