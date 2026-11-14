/**
 * The study open in the viewer, sent to the chat agent so questions such as
 * "what is the dominance in this study?" need no identifier.
 */
export interface OpenStudyContext {
  studyInstanceUID: string;
  /** DICOM modality codes of the study's display sets, active one first (e.g. "XA"). */
  modality: string;
  /** Series of the study (bounded by the orchestrator per-study limit). */
  seriesInstanceUIDs: string[];
}

/** api-pacs ORCHESTRATOR_MAX_SERIES_UIDS_PER_STUDY default. */
export const MAX_SERIES_PER_STUDY = 256;

type AnyDisplaySet = {
  StudyInstanceUID?: string;
  SeriesInstanceUID?: string;
  Modality?: string;
};

function viewportEntries(viewports: unknown): any[] {
  if (!viewports) {
    return [];
  }
  if (viewports instanceof Map) {
    return Array.from(viewports.values());
  }
  if (typeof viewports === 'object') {
    return Object.values(viewports as Record<string, unknown>);
  }
  return [];
}

function activeViewportDisplaySet(services: any): AnyDisplaySet | null {
  const { viewportGridService, displaySetService } = services;
  if (!viewportGridService?.getState || !displaySetService?.getDisplaySetByUID) {
    return null;
  }
  const state = viewportGridService.getState() || {};
  const viewports = state.viewports;
  const active =
    (viewports instanceof Map ? viewports.get(state.activeViewportId) : undefined) ||
    viewportEntries(viewports).find(viewport => viewport?.viewportId === state.activeViewportId);
  const uids: string[] = active?.displaySetInstanceUIDs || [];
  for (const uid of uids) {
    const displaySet = displaySetService.getDisplaySetByUID(uid);
    if (displaySet?.StudyInstanceUID) {
      return displaySet;
    }
  }
  return null;
}

/**
 * Resolve the open study from OHIF services: the active viewport's study, or
 * else the first loaded display set's study. Returns null when nothing is open.
 */
export function getOpenStudyContext(servicesManager: any): OpenStudyContext | null {
  const services = servicesManager?.services;
  if (!services?.displaySetService) {
    return null;
  }
  const allDisplaySets: AnyDisplaySet[] = services.displaySetService.getActiveDisplaySets?.() || [];
  const anchor =
    activeViewportDisplaySet(services) ||
    allDisplaySets.find(displaySet => displaySet?.StudyInstanceUID) ||
    null;
  const studyInstanceUID = anchor?.StudyInstanceUID;
  if (!studyInstanceUID) {
    return null;
  }

  const studyDisplaySets = allDisplaySets.filter(
    displaySet => displaySet?.StudyInstanceUID === studyInstanceUID
  );
  const modalities: string[] = [];
  const seriesInstanceUIDs: string[] = [];
  for (const displaySet of [anchor, ...studyDisplaySets]) {
    if (displaySet.Modality && !modalities.includes(displaySet.Modality)) {
      modalities.push(displaySet.Modality);
    }
    if (
      displaySet.SeriesInstanceUID &&
      !seriesInstanceUIDs.includes(displaySet.SeriesInstanceUID) &&
      seriesInstanceUIDs.length < MAX_SERIES_PER_STUDY
    ) {
      seriesInstanceUIDs.push(displaySet.SeriesInstanceUID);
    }
  }

  return {
    studyInstanceUID,
    // api-pacs caps the DICOM payload modality at 64 characters.
    modality: modalities.join(', ').slice(0, 64),
    seriesInstanceUIDs,
  };
}

/** Chat request metadata for the open study (kept small: no series list). */
export function openStudyMetadata(
  openStudy: OpenStudyContext | null
): Record<string, string> | undefined {
  if (!openStudy) {
    return undefined;
  }
  return {
    studyInstanceUID: openStudy.studyInstanceUID,
    ...(openStudy.modality ? { modality: openStudy.modality } : {}),
  };
}
