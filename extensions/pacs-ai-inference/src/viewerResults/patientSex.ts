// DICOM PatientSex of a study from the loaded display sets ('M' / 'F'), for the sex-specific
// cut-offs of the structured echo report; null when unknown or not loaded.
interface DisplaySetLike {
  StudyInstanceUID?: string;
  instance?: { PatientSex?: unknown; StudyInstanceUID?: string } | null;
  instances?: ({ PatientSex?: unknown; StudyInstanceUID?: string } | null | undefined)[];
}

export function patientSexFromDisplaySets(
  displaySets: readonly unknown[],
  studyInstanceUID: string
): string | null {
  for (const raw of displaySets) {
    const displaySet = raw as DisplaySetLike | null;
    if (!displaySet || displaySet.StudyInstanceUID !== studyInstanceUID) {
      continue;
    }
    const candidates = [displaySet.instance, ...(displaySet.instances ?? [])];
    for (const instance of candidates) {
      const sex = typeof instance?.PatientSex === 'string' ? instance.PatientSex.trim().toUpperCase() : '';
      if (sex === 'M' || sex === 'F') {
        return sex;
      }
    }
  }
  return null;
}
