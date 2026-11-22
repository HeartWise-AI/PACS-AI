type DatedStudy = { studyDate?: string | null; studyTime?: string | null; patientName?: string | null };

const when = (study: DatedStudy): string =>
  `${String(study.studyDate ?? '').trim()}${String(study.studyTime ?? '').trim()}`;

/**
 * Work-list order: most recent study first, by study date then time (DICOM
 * YYYYMMDD and HHMMSS sort as text); studies without a date go last. Ties
 * keep patient-name order so the list is stable.
 */
export function sortStudiesNewestFirst<T extends DatedStudy>(studies: T[] = []): T[] {
  return [...studies].sort((a, b) => {
    const byWhen = when(b).localeCompare(when(a));
    if (byWhen !== 0) {
      return byWhen;
    }
    return String(a.patientName ?? '').localeCompare(String(b.patientName ?? ''));
  });
}
