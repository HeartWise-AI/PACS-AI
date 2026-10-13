import type { GetInferenceModelVersionResponse } from '../../../api/inferenceDTO';

export function getDefaultDeployableVersionId(
  versions: GetInferenceModelVersionResponse[]
): string {
  return versions.find(version => version.status === 'AVAILABLE' && !version.active)?.id || '';
}
