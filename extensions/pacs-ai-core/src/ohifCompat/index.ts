/**
 * The only place our code touches OHIF APIs that the upgrade plan knows will
 * change (docs/ohif-upgrade/PLAN.md 6.4). Our packages import these, never the
 * underlying OHIF API directly; a yearly upgrade edits this directory first.
 *
 * Modules that need @ohif/core at runtime (useSafeCustomization,
 * viewportElement, dates, studyMetadata) are not re-exported here, so that
 * importing the plain helpers does not load @ohif/core; import them by path.
 */
export { getSafeCustomization } from './customization';
export { getActiveDisplaySets, getDisplaySetByUID, hasDisplaySetLookup } from './displaySets';
export { getSeriesMetadataRetriever, forgetStudyMetadata } from './dicomweb';
export type { SeriesMetadataDataSource } from './dicomweb';
