import type { DisplaySet } from '../types';

/**
 * Helper function to format series info for display
 */
export function formatSeriesInfo(displaySet: DisplaySet | null | undefined): string {
  if (!displaySet) return 'No display set data';

  const studyInstanceUID = displaySet.StudyInstanceUID || displaySet.studyInstanceUID || 'Unknown';
  const seriesInstanceUID =
    displaySet.SeriesInstanceUID || displaySet.seriesInstanceUID || 'Unknown';
  const seriesDescription =
    displaySet.SeriesDescription ||
    displaySet.seriesDescription ||
    displaySet.description ||
    'No description';
  const seriesNumber = displaySet.SeriesNumber || displaySet.seriesNumber || 'Unknown';
  const modality = displaySet.Modality || displaySet.modality || 'Unknown';
  const instanceCount =
    displaySet.numImageFrames || displaySet.numInstances || displaySet.images?.length || 'Unknown';

  // Additional data if available
  const studyDate = displaySet.StudyDate || displaySet.studyDate || 'Unknown';
  const accessionNumber = displaySet.AccessionNumber || displaySet.accessionNumber || 'Unknown';

  return [
    `Study UID: ${studyInstanceUID}`,
    `Series ID: ${seriesInstanceUID}`,
    `Description: ${seriesDescription}`,
    `Number: ${seriesNumber}`,
    `Modality: ${modality}`,
    `Instance Count: ${instanceCount}`,
    `Study Date: ${studyDate}`,
    `Accession: ${accessionNumber}`,
  ].join('\n');
}
