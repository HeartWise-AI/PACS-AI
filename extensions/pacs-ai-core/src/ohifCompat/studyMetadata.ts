import { DicomMetadataStore } from '@ohif/core';

/**
 * OHIF compatibility adapter (PLAN.md 6.4): study metadata held by OHIF's
 * DicomMetadataStore (read only).
 */
export function getStudyMetadata<T = any>(studyInstanceUID: string): T | undefined {
  return DicomMetadataStore.getStudy(studyInstanceUID) as T | undefined;
}
