import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudyNotificationMetadataResolver } from '../../components/inference/studyNotificationMetadata';
import type { PredictionsRepository } from './predictionsRepository';
import { buildPredictionsListParams, predictionsDateRange } from './predictionsQuery';
import { patientNameMatches, predictionStudyLabels } from './studyLabels';
import type {
  PredictionExam,
  PredictionsFilters,
  PredictionsPage,
  PredictionStudyLabels,
} from './types';

export type PredictionsLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export const ACTIVE_REFRESH_MS = 15_000;

export interface PredictionsPageState {
  status: PredictionsLoadStatus;
  page: PredictionsPage | null;
  error: { status: number | null } | null;
  // Exams loaded before the search whose patient name matches it; the server
  // cannot search names because it does not store them.
  nameMatches: PredictionExam[];
  labels: Record<string, PredictionStudyLabels>;
  invalidDateRange: boolean;
  reload: () => void;
}

interface Options {
  filters: PredictionsFilters;
  repository: PredictionsRepository;
  resolver: StudyNotificationMetadataResolver;
  // False until the user's role is known, so "all" is never requested blindly.
  enabled: boolean;
  now?: () => Date;
}

export function usePredictionsPage({
  filters,
  repository,
  resolver,
  enabled,
  now = () => new Date(),
}: Options): PredictionsPageState {
  const [status, setStatus] = useState<PredictionsLoadStatus>('idle');
  const [page, setPage] = useState<PredictionsPage | null>(null);
  const [error, setError] = useState<{ status: number | null } | null>(null);
  const [labels, setLabels] = useState<Record<string, PredictionStudyLabels>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const unsearchedExamsRef = useRef<PredictionExam[]>([]);
  const nowRef = useRef(now);
  nowRef.current = now;

  const invalidDateRange = predictionsDateRange(filters, nowRef.current()).invalid;
  // Relative date presets are computed when the request is made, so the
  // query only changes when a filter changes or the page reloads.
  const queryKey = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled || invalidDateRange) {
      return;
    }
    let cancelled = false;
    setStatus(current => (current === 'ready' ? 'ready' : 'loading'));
    const params = buildPredictionsListParams(filters, nowRef.current());
    repository
      .listPredictions(params)
      .then(result => {
        if (cancelled) {
          return;
        }
        setPage(result);
        setError(null);
        setStatus('ready');
        if (!filters.search.trim()) {
          unsearchedExamsRef.current = result.exams;
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }
        const statusCode =
          typeof reason === 'object' && reason !== null && 'status' in reason
            ? ((reason as { status: number | null }).status ?? null)
            : null;
        setError({ status: statusCode });
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, enabled, invalidDateRange, repository, reloadKey]);

  // A filter change shows the loading state instead of the previous rows.
  useEffect(() => {
    setStatus(current => (current === 'idle' ? current : 'loading'));
  }, [queryKey]);

  const exams = page?.exams;
  useEffect(() => {
    const candidates = [...(exams ?? []), ...unsearchedExamsRef.current];
    let cancelled = false;
    for (const exam of candidates) {
      const uid = exam.studyInstanceUID;
      const cached = resolver.peek(uid);
      if (cached) {
        setLabels(current =>
          current[uid] ? current : { ...current, [uid]: predictionStudyLabels(exam, cached) }
        );
        continue;
      }
      resolver.resolve(uid).then(metadata => {
        if (!cancelled) {
          setLabels(current => ({ ...current, [uid]: predictionStudyLabels(exam, metadata) }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [exams, resolver]);

  const hasActive = Boolean(exams?.some(exam => exam.active));
  useEffect(() => {
    if (!hasActive) {
      return;
    }
    const timer = setInterval(() => setReloadKey(key => key + 1), ACTIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasActive]);

  const search = filters.search.trim();
  const nameMatches = useMemo(() => {
    if (!search || !exams) {
      return [];
    }
    const shown = new Set(exams.map(exam => exam.studyInstanceUID));
    return unsearchedExamsRef.current.filter(exam => {
      const examLabels = labels[exam.studyInstanceUID];
      return (
        !shown.has(exam.studyInstanceUID) && examLabels && patientNameMatches(examLabels, search)
      );
    });
  }, [search, exams, labels]);

  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  return { status, page, error, nameMatches, labels, invalidDateRange, reload };
}
