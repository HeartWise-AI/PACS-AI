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
