// Reloads the series of a study that is open in the viewer, in place, through
// the data source: it re-runs the series metadata retrieval, the metadata
// store announces the instances, and the mode's own listener asks
// displaySetService for display sets. That call is idempotent, so series the
// viewer already shows are left alone and only new images become display sets.

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
  return typeof dataSource?.retrieve?.series?.metadata === 'function';
}

export async function reloadStudySeries(
  dataSource: StudySeriesDataSource,
  studyInstanceUID: string
): Promise<void> {
  const metadata = dataSource.retrieve?.series?.metadata;
  if (typeof metadata !== 'function') {
    throw new Error('The data source cannot reload the series of a study.');
  }
  // The DICOMweb data source caches the retrieval of a study under
  // "<data source name>:<StudyInstanceUID>" and deletes the key it is given,
  // so both forms are dropped: the bare UID is what the API documents.
  if (typeof dataSource.deleteStudyMetadataPromise === 'function') {
    dataSource.deleteStudyMetadataPromise(studyInstanceUID);
    dataSource.deleteStudyMetadataPromise(`${dataSource.getConfig?.()?.name}:${studyInstanceUID}`);
  }
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
