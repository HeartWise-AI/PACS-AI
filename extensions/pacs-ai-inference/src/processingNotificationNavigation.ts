import { studyOpenPath } from '@pacs-ai/extension-core/src/utils/viewerUrl';

export const PROCESSING_NOTIFICATION_STUDY_PARAM = 'processingStudyInstanceUID';

export function buildProcessingNotificationWorklistPath(studyInstanceUID: string): string {
  const searchParams = new URLSearchParams({
    [PROCESSING_NOTIFICATION_STUDY_PARAM]: studyInstanceUID,
  });

  return `/?${searchParams.toString()}`;
}

export function findProcessingNotificationStudyPage(
  studyInstanceUIDs: string[],
  targetStudyInstanceUID: string,
  itemsPerPage: number
): number | null {
  const studyIndex = studyInstanceUIDs.indexOf(targetStudyInstanceUID);
  if (studyIndex < 0 || itemsPerPage <= 0) {
    return null;
  }

  return Math.floor(studyIndex / itemsPerPage) + 1;
}

/**
 * Link that opens the study a processing notification is about. It goes
 * through /open-study, which retrieves the study from the PACS when the local
 * store no longer has it (as the work list does) and remounts the viewer when
 * the bell is used from inside it.
 */
export function buildProcessingNotificationViewerPath(studyInstanceUID: string): string {
  return studyOpenPath(studyInstanceUID);
}
