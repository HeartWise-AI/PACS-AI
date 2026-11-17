import { useSyncExternalStore } from 'react';

// Whether the server still considers a study to be growing (its processing
// run waits with `waitingReason: "study_growing"`). The viewer's running-jobs
// indicator already polls that run and publishes it here, so the refresh
// button can hint that the local copy may be behind without polling anything.

const growingStudies = new Set<string>();
const listeners = new Set<() => void>();

export function publishStudyGrowing(
  studyInstanceUID: string | null | undefined,
  growing: boolean
): void {
  const uid = studyInstanceUID?.trim();
  if (!uid || growingStudies.has(uid) === growing) {
    return;
  }
  if (growing) {
    growingStudies.add(uid);
  } else {
    growingStudies.delete(uid);
  }
  listeners.forEach(listener => listener());
}

export function isStudyGrowing(studyInstanceUID: string | null | undefined): boolean {
  const uid = studyInstanceUID?.trim();
  return !!uid && growingStudies.has(uid);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStudyGrowing(studyInstanceUID: string | null | undefined): boolean {
  const read = () => isStudyGrowing(studyInstanceUID);
  return useSyncExternalStore(subscribe, read, read);
}
