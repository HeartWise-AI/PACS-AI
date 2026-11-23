import { useEffect, useRef, useState } from 'react';
import inferenceRepository from '@pacs-ai/extension-core/src/api/inferenceRepository';
import type { FeedbackReportCount } from '@pacs-ai/extension-core/src/api/inferenceDTO';

export interface FeedbackReportCountsQuery {
  // RFC3339 bounds of the prior period start, the current period start and its end.
  priorFrom: string;
  from: string;
  to: string;
}

export interface UseFeedbackReportCountsResult {
  // Completed reports per model; null while unknown or when the call failed.
  current: FeedbackReportCount[] | null;
  prior: FeedbackReportCount[] | null;
}

async function load(from: string, to: string): Promise<FeedbackReportCount[] | null> {
  try {
    const response = await inferenceRepository.ListFeedbackReportCounts({ from, to });
    return response?.data?.models ?? [];
  } catch (failure) {
    console.error('Error fetching feedback report counts:', failure);
    return null;
  }
}

/**
 * Reports returned in the current and prior periods, the denominator of
 * "reports rated". A failure yields null counts so the page still renders.
 */
export function useFeedbackReportCounts({
  active,
  query,
  reloadKey = 0,
}: {
  active: boolean;
  query: FeedbackReportCountsQuery;
  reloadKey?: number;
}): UseFeedbackReportCountsResult {
  const [counts, setCounts] = useState<UseFeedbackReportCountsResult>({
    current: null,
    prior: null,
  });
  const requestRef = useRef(0);
  const { priorFrom, from, to } = query;

  useEffect(() => {
    if (!active) {
      return;
    }
    const requestId = ++requestRef.current;
    Promise.all([load(from, to), load(priorFrom, from)]).then(([current, prior]) => {
      if (requestId === requestRef.current) {
        setCounts({ current, prior });
      }
    });
  }, [active, priorFrom, from, to, reloadKey]);

  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    []
  );

  return counts;
}
