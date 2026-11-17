// Keep modality keys: both AIModelButton implementations use them to filter models.
// Append exams sharing a modality instead of replacing the previous exam.
export function buildInferenceStudyModalities(studies: any[]) {
  return studies.reduce((groups, study) => {
    const { modalities, displaySets, studyInstanceUid, date, description } = study;
    if (!modalities || !studyInstanceUid) return groups;
    const group = groups[modalities] || { modality: modalities, displaySets: [] };
    groups[modalities] = {
      ...group,
      displaySets: [...group.displaySets, ...(displaySets || []).map(displaySet => ({
        ...displaySet,
        StudyInstanceUID: studyInstanceUid,
        studyDate: date,
        studyDescription: description,
      }))],
    };
    return groups;
  }, {} as Record<string, { modality: string; displaySets: any[] }>);
}
