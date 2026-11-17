import type { GetInferenceModelVersionResponse } from '@pacs-ai/extension-core/src/api/inferenceDTO';

export function getDefaultDeployableVersionId(
  versions: GetInferenceModelVersionResponse[]
): string {
  return versions.find(version => version.status === 'AVAILABLE' && !version.active)?.id || '';
}
