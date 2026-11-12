import { useEffect, useState } from 'react';
import { getAuthenticatedScope } from './authenticatedScope';
import inferenceRepository from '../../../api/inferenceRepository';
import type { GetInferenceGPUsResponse } from '../../../api/inferenceDTO';

export function useGPUInventory(enabled: boolean, refreshKey = '', scopeKey = '') {
  const [sample, setSample] = useState<{
    scopeKey: string;
    value: GetInferenceGPUsResponse | null;
  }>({ scopeKey, value: null });
  const inventory = sample.scopeKey === scopeKey ? sample.value : null;
  const setInventory = (value: GetInferenceGPUsResponse | null) => setSample({ scopeKey, value });
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stopped = false;
    const scopeIsCurrent = () => !scopeKey || getAuthenticatedScope().key === scopeKey;
    setInventory(null);
    setStale(false);
    setError(false);
    setLoading(false);
    let denied = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const clear = () => {
      clearTimeout(timer);
      request?.abort();
      request = undefined;
    };
    const poll = async () => {
      if (
        stopped ||
        denied ||
        !enabled ||
        !scopeIsCurrent() ||
        document.visibilityState === 'hidden'
      )
        return;
      request = new AbortController();
      const current = request;
      setLoading(true);
      try {
        const response = await inferenceRepository.GetInferenceGPUs(current.signal);
        if (stopped || current.signal.aborted || !scopeIsCurrent()) return;
        setInventory(response.data);
        setStale(false);
        setError(false);
      } catch (_error) {
        if (stopped || current.signal.aborted || !scopeIsCurrent()) return;
        const status = (_error as { status?: number })?.status;
        if (status === 401 || status === 403) {
          denied = true;
          setInventory(null);
        }
        setStale(true);
        setError(true);
      } finally {
        if (!stopped && !current.signal.aborted && scopeIsCurrent()) {
          setLoading(false);
          if (!denied) timer = setTimeout(poll, 5000);
        }
      }
    };
    const visibility = () => {
      clear();
      if (document.visibilityState !== 'hidden') void poll();
      else setStale(true);
    };
    if (enabled) {
      document.addEventListener('visibilitychange', visibility);
      void poll();
    } else {
      setInventory(null);
      setError(false);
      setStale(false);
      setLoading(false);
    }
    return () => {
      stopped = true;
      clear();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, refreshKey, scopeKey]);
  return { inventory, stale, loading, error };
}
