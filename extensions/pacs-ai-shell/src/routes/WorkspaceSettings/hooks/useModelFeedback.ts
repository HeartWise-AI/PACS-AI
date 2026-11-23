import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertContext } from '../../../alerts';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import type {
  ListModelFeedbackRequest,
  ListModelFeedbackResponse,
} from '@pacs-ai/extension-core/src/api/inferenceDTO';
import { handleUnauthorizedAccess } from '../utils';
import { useAuthenticatedScope } from './authenticatedScope';

export interface ModelFeedbackQuery {
  // Inference model id, or '' for every model.
  model: string;
  // RFC3339 bounds, or undefined for none.
  from?: string;
  to?: string;
}

export interface UseModelFeedbackResult {
  data: ListModelFeedbackResponse | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

/**
 * The tenant's model feedback for the admin tab. Loads only while the tab is
 * active, again whenever the query changes, and on refresh.
 */
export function useModelFeedback({
  active,
  query,
}: {
  active: boolean;
  query: ModelFeedbackQuery;
}): UseModelFeedbackResult {
  const showAlert = useContext(AlertContext);
  const navigate = useNavigate();
  const { tenantId } = useAuthenticatedScope();
  const [data, setData] = useState<ListModelFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);

  const { model, from, to } = query;

  useEffect(() => {
    if (!active) {
      return;
    }
    const requestId = ++requestRef.current;
    const request: ListModelFeedbackRequest = {};
    if (model) {
      request.model = model;
    }
    if (from) {
      request.from = from;
    }
    if (to) {
      request.to = to;
    }

    setLoading(true);
    setError(false);
    inferenceRepository
      .ListModelFeedback(request)
      .then(response => {
        if (requestId !== requestRef.current) {
          return;
        }
        const value = response?.data;
        setData({
          summary: value?.summary ?? [],
          items: value?.items ?? [],
          truncated: !!value?.truncated,
        });
      })
      .catch(failure => {
        if (requestId !== requestRef.current) {
          return;
        }
        handleUnauthorizedAccess(failure ?? {}, showAlert, navigate, tenantId);
        console.error('Error fetching model feedback:', failure);
        setError(true);
      })
      .finally(() => {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showAlert from AlertContext is unstable
  }, [active, model, from, to, reloadKey, tenantId]);

  useEffect(
    () => () => {
      // Ignore answers that arrive after unmount.
      requestRef.current += 1;
    },
    []
  );

  const refresh = useCallback(() => setReloadKey(key => key + 1), []);

  return { data, loading, error, refresh };
}
