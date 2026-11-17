/**
 * OHIF compatibility adapter (PLAN.md 6.4): what we use from the DICOMweb data
 * source. Plain module (no @ohif/core import) so
 * callers stay testable without an OHIF app.
 */
export type SeriesMetadataDataSource = {
  retrieve?: {
    series?: {
      metadata?: (options: { StudyInstanceUID: string; madeInClient?: boolean }) => unknown;
    };
  };
  deleteStudyMetadataPromise?: (key: string) => void;
  getConfig?: () => { name?: string } | undefined;
};

/** Series metadata retrieval of a data source, or undefined if it has none. */
export function getSeriesMetadataRetriever(
  dataSource: SeriesMetadataDataSource | null | undefined
) {
  const metadata = dataSource?.retrieve?.series?.metadata;
  return typeof metadata === 'function' ? metadata : undefined;
}

/**
 * Drops the data source's cached study retrieval so the next retrieval asks
 * the server again. 3.11.1 caches under "<data source name>:<StudyInstanceUID>"
 * while its API documents the bare UID, so both keys are dropped.
 */
export function forgetStudyMetadata(
  dataSource: SeriesMetadataDataSource,
  studyInstanceUID: string
): void {
  if (typeof dataSource.deleteStudyMetadataPromise !== 'function') {
    return;
  }
  dataSource.deleteStudyMetadataPromise(studyInstanceUID);
  dataSource.deleteStudyMetadataPromise(`${dataSource.getConfig?.()?.name}:${studyInstanceUID}`);
}
