import { PROCESSING_NOTIFICATION_STUDY_PARAM } from '../../components/inference/processingNotificationNavigation';
import {
  createWorklistSearchFilters,
  WORKLIST_SEARCH_FILTER_KEYS,
  type WorklistSearchFilters,
} from '../../utils/worklistSearchSession';

export interface URLWorklistSearchRestore {
  filters: WorklistSearchFilters;
  notificationStudyInstanceUID: string | null;
  shouldSearch: boolean;
}

export type ProcessingNotificationSearchTransition =
  | { kind: 'enter'; studyInstanceUID: string }
  | { kind: 'leave' }
  | null;

export function getProcessingNotificationSearchTransition(
  handledStudyInstanceUID: string | null,
  requestedStudyInstanceUID: string | null
): ProcessingNotificationSearchTransition {
  if (requestedStudyInstanceUID) {
    return requestedStudyInstanceUID === handledStudyInstanceUID
      ? null
      : { kind: 'enter', studyInstanceUID: requestedStudyInstanceUID };
  }

  return handledStudyInstanceUID ? { kind: 'leave' } : null;
}

export function getFiltersFromSearchParams(
  searchParams: URLSearchParams,
  fallbackDICOMModality: string,
  defaultStudyDate: string
): URLWorklistSearchRestore {
  const filters = createWorklistSearchFilters({ modalityId: fallbackDICOMModality });
  let shouldSearch = false;

  WORKLIST_SEARCH_FILTER_KEYS.forEach(key => {
    const value = searchParams.get(key);
    if (value !== null) {
      filters[key] = value;
      shouldSearch = true;
    }
  });

  const notificationStudyInstanceUID = searchParams.get(PROCESSING_NOTIFICATION_STUDY_PARAM);
  if (notificationStudyInstanceUID) {
    filters.studyInstanceUID = notificationStudyInstanceUID;
    shouldSearch = true;
  }

  if (!shouldSearch) {
    filters.studyDate = defaultStudyDate;
  }

  return {
    filters,
    notificationStudyInstanceUID,
    shouldSearch,
  };
}
