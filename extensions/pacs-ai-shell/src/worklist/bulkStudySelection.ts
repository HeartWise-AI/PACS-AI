export const MAX_BULK_STUDY_SELECTION = 10;

export function toggleBulkStudySelection(
  selectedStudyInstanceUIDs: string[],
  studyInstanceUID: string
): string[] {
  if (selectedStudyInstanceUIDs.includes(studyInstanceUID)) {
    return selectedStudyInstanceUIDs.filter(selected => selected !== studyInstanceUID);
  }

  if (selectedStudyInstanceUIDs.length >= MAX_BULK_STUDY_SELECTION) {
    return selectedStudyInstanceUIDs;
  }

  return [...selectedStudyInstanceUIDs, studyInstanceUID];
}

export function selectVisibleBulkStudies(eligibleStudyInstanceUIDs: string[]): string[] {
  return [...new Set(eligibleStudyInstanceUIDs)].slice(0, MAX_BULK_STUDY_SELECTION);
}

export function retainBulkStudySelection(
  selectedStudyInstanceUIDs: string[],
  eligibleStudyInstanceUIDs: string[]
): string[] {
  const eligible = new Set(eligibleStudyInstanceUIDs);
  return selectedStudyInstanceUIDs.filter(studyInstanceUID => eligible.has(studyInstanceUID));
}
