import React, { useCallback, useEffect, useMemo } from 'react';
import { getStudyMetadata } from '@pacs-ai/extension-core/src/ohifCompat/studyMetadata';
import { StudyRefreshButton } from './StudyRefreshButton';
import {
  canReloadStudySeries,
  reloadStudySeries,
  snapshotStudySeries,
  type StudySeriesDataSource,
} from './reloadStudySeries';
import { useStudyGrowing } from './studyGrowingStore';
import { useStudyRefresh } from './useStudyRefresh';
import { createStudyRefreshRepository } from './studyRefreshRepository';
import {
  followPendingRetrieve,
  rememberPendingRetrieve,
  takePendingRetrieveHandover,
} from './progressiveRetrieve';

export { createStudyRefreshRepository } from './studyRefreshRepository';

export interface ViewerStudyRefreshProps {
  studyInstanceUID: string | null | undefined;
  // The viewer's active data source.
  dataSource: StudySeriesDataSource | null | undefined;
}

/**
 * "Refresh study from PACS" for the study open in the viewer; mounted in the
 * study browser header. Renders nothing when the data source cannot reload a
 * study's series.
 */
export function ViewerStudyRefresh({ studyInstanceUID, dataSource }: ViewerStudyRefreshProps) {
  const uid = studyInstanceUID?.trim() || null;
  const repository = useMemo(() => createStudyRefreshRepository(), []);
  const reloadSeries = useCallback(
    (study: string) => reloadStudySeries(dataSource as StudySeriesDataSource, study),
    [dataSource]
  );
  const getSeriesSnapshot = useCallback(
    (study: string) => snapshotStudySeries(getStudyMetadata(study)),
    []
  );
  const { state, refresh } = useStudyRefresh({
    studyInstanceUID: uid,
    repository,
    reloadSeries,
    getSeriesSnapshot,
  });
  const growing = useStudyGrowing(uid);

  // Opened from the work list before the whole study was stored: show the
  // remaining series as they arrive.
  useEffect(() => {
    if (!uid || !canReloadStudySeries(dataSource)) {
      return undefined;
    }
    const handover = takePendingRetrieveHandover(uid);
    if (!handover) {
      return undefined;
    }
    let cancelled = false;
    let finished = false;
    void followPendingRetrieve({
      jobIds: handover.jobIds,
      loadJobs: repository.loadJobs,
      reload: () => reloadSeries(uid),
      isCancelled: () => cancelled,
    }).then(outcome => {
      finished = outcome !== 'cancelled';
    });
    return () => {
      cancelled = true;
      // The study browser unmounts this when its panel closes: hand the jobs
      // back so the follow resumes when it opens again.
      if (!finished) {
        rememberPendingRetrieve(uid, handover.jobIds, { at: handover.at });
      }
    };
  }, [uid, dataSource, repository, reloadSeries]);

  if (!uid || !canReloadStudySeries(dataSource)) {
    return null;
  }

  return (
    <StudyRefreshButton
      state={state}
      growing={growing}
      onRefresh={() => void refresh()}
    />
  );
}

export default ViewerStudyRefresh;
