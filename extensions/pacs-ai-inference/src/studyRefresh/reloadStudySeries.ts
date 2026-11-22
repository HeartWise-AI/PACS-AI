// Reloads the series of a study that is open in the viewer, in place, through
// the data source: it re-runs the series metadata retrieval, the metadata
// store announces the instances, and the mode's own listener asks
// displaySetService for display sets. That call is idempotent, so series the
// viewer already shows are left alone and only new images become display sets.

import {
  forgetStudyMetadata,
  getSeriesMetadataRetriever,
} from '@pacs-ai/extension-core/src/ohifCompat/dicomweb';

export interface StudySeriesDataSource {
  retrieve?: {
    series?: {
      metadata?: (options: {
        StudyInstanceUID: string;
        madeInClient?: boolean;
      }) => Promise<unknown>;
    };
  };
  deleteStudyMetadataPromise?: (key: string) => void;
  getConfig?: () => { name?: string } | null | undefined;
}

export function canReloadStudySeries(dataSource: StudySeriesDataSource | null | undefined) {
  return getSeriesMetadataRetriever(dataSource) !== undefined;
}

export async function reloadStudySeries(
  dataSource: StudySeriesDataSource,
  studyInstanceUID: string
): Promise<void> {
  const metadata = getSeriesMetadataRetriever(dataSource);
  if (!metadata) {
    throw new Error('The data source cannot reload the series of a study.');
  }
  // Both cache keys of the study retrieval are dropped (see forgetStudyMetadata).
  forgetStudyMetadata(dataSource, studyInstanceUID);
  await metadata({ StudyInstanceUID: studyInstanceUID, madeInClient: false });
}

export interface StudySeriesSnapshot {
  seriesInstanceUIDs: string[];
  instances: number;
}

interface MetadataStoreStudy {
  series?: Array<{ SeriesInstanceUID?: string; instances?: unknown[] }>;
}

/** What the viewer's metadata store holds for a study. */
export function snapshotStudySeries(
  study: MetadataStoreStudy | null | undefined
): StudySeriesSnapshot {
  const series = Array.isArray(study?.series) ? study.series : [];
  return {
    seriesInstanceUIDs: series
      .map(item => item?.SeriesInstanceUID)
      .filter((uid): uid is string => typeof uid === 'string' && uid !== ''),
    instances: series.reduce(
      (count, item) => count + (Array.isArray(item?.instances) ? item.instances.length : 0),
      0
    ),
  };
}
