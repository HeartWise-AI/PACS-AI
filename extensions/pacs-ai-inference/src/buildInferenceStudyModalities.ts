// Keep modality keys: both AIModelButton implementations use them to filter models.
// Append exams sharing a modality instead of replacing the previous exam.
// `studies` lists each group's exams as soon as the study list knows them,
// before their images (display sets) load, so the AI menu can show them early.
export interface InferenceStudySummary {
  studyInstanceUID: string;
  date?: string;
  description?: string;
}

export function buildInferenceStudyModalities(studies: any[]) {
  return studies.reduce(
    (groups, study) => {
      const { modalities, displaySets, studyInstanceUid, date, description } = study;
      if (!modalities || !studyInstanceUid) return groups;
      const group = groups[modalities] || { modality: modalities, displaySets: [], studies: [] };
      const known = group.studies.some(item => item.studyInstanceUID === studyInstanceUid);
      groups[modalities] = {
        ...group,
        studies: known
          ? group.studies
          : [...group.studies, { studyInstanceUID: studyInstanceUid, date, description }],
        displaySets: [
          ...group.displaySets,
          ...(displaySets || []).map(displaySet => ({
            ...displaySet,
            StudyInstanceUID: studyInstanceUid,
            studyDate: date,
            studyDescription: description,
          })),
        ],
      };
      return groups;
    },
    {} as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OHIF display sets, as before
      { modality: string; displaySets: any[]; studies: InferenceStudySummary[] }
    >
  );
}

/** Every exam in the groups, in group order, without duplicates. */
export function inferenceStudyUIDs(
  groups: Record<
    string,
    { studies?: InferenceStudySummary[]; displaySets?: Array<{ StudyInstanceUID?: string }> }
  >
): string[] {
  const uids: string[] = [];
  for (const group of Object.values(groups || {})) {
    for (const uid of [
      ...(group.studies || []).map(study => study.studyInstanceUID),
      ...(group.displaySets || []).map(displaySet => displaySet?.StudyInstanceUID),
    ]) {
      if (uid && !uids.includes(uid)) {
        uids.push(uid);
      }
    }
  }
  return uids;
}
