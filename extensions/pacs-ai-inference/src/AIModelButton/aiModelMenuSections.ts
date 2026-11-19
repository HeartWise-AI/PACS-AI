import type { InferenceStudySummary } from '../buildInferenceStudyModalities';

/**
 * One block of the AI Models menu: an open exam and the models that accept
 * its modality. With several exams open (e.g. a TTE and an angiogram), each
 * exam gets its own block, so an echo model is never offered on the
 * angiogram and each block shows that exam's results.
 */
export interface AIModelMenuSection<Model> {
  // null when the exam is not known yet (no study list entry, no images).
  studyInstanceUID: string | null;
  // The study-list modality key, e.g. "US" or "XA\\SR".
  modality: string;
  date?: string;
  description?: string;
  models: Model[];
}

interface ModalityGroup {
  studies?: InferenceStudySummary[];
  displaySets?: Array<{ StudyInstanceUID?: string; studyDate?: string; studyDescription?: string }>;
}

interface MenuModel {
  supportedDicomModalities?: string[];
}

function groupStudies(group: ModalityGroup): InferenceStudySummary[] {
  if (group.studies?.length) {
    return group.studies;
  }
  const studies: InferenceStudySummary[] = [];
  for (const displaySet of group.displaySets || []) {
    const uid = displaySet?.StudyInstanceUID;
    if (uid && !studies.some(study => study.studyInstanceUID === uid)) {
      studies.push({
        studyInstanceUID: uid,
        date: displaySet.studyDate,
        description: displaySet.studyDescription,
      });
    }
  }
  return studies;
}

export function buildAIModelMenuSections<Model extends MenuModel>(
  groups: Record<string, ModalityGroup> | null | undefined,
  models: Model[]
): AIModelMenuSection<Model>[] {
  const sections: AIModelMenuSection<Model>[] = [];
  for (const [modality, group] of Object.entries(groups || {})) {
    const sectionModels = models.filter(model =>
      model.supportedDicomModalities?.some(supported => modality.includes(supported))
    );
    if (!sectionModels.length) {
      continue;
    }
    const studies = groupStudies(group || {});
    if (!studies.length) {
      sections.push({ studyInstanceUID: null, modality, models: sectionModels });
      continue;
    }
    for (const study of studies) {
      sections.push({
        studyInstanceUID: study.studyInstanceUID,
        modality,
        date: study.date,
        description: study.description,
        models: sectionModels,
      });
    }
  }
  return sections;
}

/** "XA · 2026-11-17 · CORONAROGRAPHIE" */
export function aiModelMenuSectionTitle(section: AIModelMenuSection<unknown>): string {
  return [section.modality.replace(/\\/g, '/'), section.date, section.description]
    .map(part => (part || '').trim())
    .filter(Boolean)
    .join(' · ');
}
