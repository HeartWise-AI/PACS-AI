import React, { useCallback, useMemo } from 'react';
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
