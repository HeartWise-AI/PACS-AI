interface InferenceSeriesMetadata {
  description?: string;
  SeriesDescription?: string;
  modality?: string;
  Modality?: string;
  SOPClassUID?: string;
  sopClassUids?: string[];
  numImageFrames?: number | string;
  NumberOfFrames?: number | string;
  isMultiFrame?: boolean;
}

const reportDescription = /(?:^|[^a-z])(rapport|report|pdf)(?:$|[^a-z])/i;
const encapsulatedPDFStorage = '1.2.840.10008.5.1.4.1.1.104.1';
const structuredReportStoragePrefix = '1.2.840.10008.5.1.4.1.1.88.';

/** Exclude report documents and known still images from video inference selection. */
export function isInferenceSeriesEligible(displaySet: InferenceSeriesMetadata): boolean {
  if ([displaySet.description, displaySet.SeriesDescription].some(
    description => typeof description === 'string' && reportDescription.test(description)
  )) return false;

  const modality = (displaySet.modality || displaySet.Modality || '').toUpperCase();
  if (['SR', 'DOC', 'PDF'].includes(modality)) return false;

  const sopClasses = [displaySet.SOPClassUID, ...(displaySet.sopClassUids || [])];
  if (sopClasses.some(uid => uid === encapsulatedPDFStorage || uid?.startsWith(structuredReportStoragePrefix))) {
    return false;
  }

  // One DICOM instance can contain a full cine. Never use an instance count as a frame count.
  const frameCount = Number(displaySet.numImageFrames ?? displaySet.NumberOfFrames);
  if (Number.isFinite(frameCount) && frameCount <= 1 && !displaySet.isMultiFrame) return false;
  return true;
}
