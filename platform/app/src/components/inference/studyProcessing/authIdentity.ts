export interface StudyProcessingAuthIdentity {
  id: string;
  tenantId: string;
}

export function getStudyProcessingAuthIdentity({
  id,
  tenantId,
}: StudyProcessingAuthIdentity): string {
  return JSON.stringify([tenantId, id]);
}

export function shouldClearStudyProcessingState(
  previousIdentity: string | null,
  nextIdentity: string | null
): boolean {
  if (nextIdentity === null) {
    return true;
  }

  return previousIdentity !== null && previousIdentity !== nextIdentity;
}
