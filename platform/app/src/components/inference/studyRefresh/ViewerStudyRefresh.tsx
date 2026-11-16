import React, { useCallback, useMemo } from 'react';
import { DicomMetadataStore } from '@ohif/core';
import orthancRepository from '../../../api/orthancRepository';
import { Error as APIErrorCode } from '../../../api/dto';
import { StudyRefreshButton } from './StudyRefreshButton';
import {
  canReloadStudySeries,
  reloadStudySeries,
  snapshotStudySeries,
  type StudySeriesDataSource,
} from './reloadStudySeries';
import { useStudyGrowing } from './studyGrowingStore';
import { useStudyRefresh, type StudyRefreshRepository } from './useStudyRefresh';

export interface ViewerStudyRefreshProps {
  studyInstanceUID: string | null | undefined;
  // The viewer's active data source.
  dataSource: StudySeriesDataSource | null | undefined;
}

/** The api-pacs calls of the refresh, as the work list makes them. */
export function createStudyRefreshRepository(api = orthancRepository): StudyRefreshRepository {
  return {
    loadModalities: async () => {
      const response = await api.GetDICOMModalities();
      return response.data?.modalities ?? null;
    },
    retrieveStudy: async request => {
      try {
        const response = await api.RetrieveModalityStudy(request);
        return (response.data ?? []).map(job => job.id).filter(Boolean);
      } catch (error: unknown) {
        // The server answers "duplicate" when the local copy already has
        // every series of the PACS: there is nothing to wait for.
        if ((error as { errorCode?: string } | null)?.errorCode === APIErrorCode.DUPLICATE_RECORD) {
          return [];
        }
        throw error;
      }
    },
    loadJobs: async jobIds => {
      const response = await api.GetJobsInfo({ jobIds });
      const jobs = response.data as unknown;
      return Array.isArray(jobs) ? jobs : [];
    },
  };
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
    (study: string) => snapshotStudySeries(DicomMetadataStore.getStudy(study)),
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
