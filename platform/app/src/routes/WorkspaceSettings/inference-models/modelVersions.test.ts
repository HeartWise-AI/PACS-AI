import type { GetInferenceModelVersionResponse } from '../../../api/inferenceDTO';
import { getDefaultDeployableVersionId } from './modelVersions';

const version = (
  id: string,
  status: GetInferenceModelVersionResponse['status'],
  active = false
): GetInferenceModelVersionResponse => ({
  id,
  modelId: 'DeepCORO-SYNTAX',
  version: '1.0.0',
  imageReference: `heartwisehub/deepcoro-syntax:${id}`,
  imageDigest: `sha256:${'a'.repeat(64)}`,
  provenance: {
    sourceRepository: 'HeartWise-AI/pacs-ai-backend',
    sourceRevision: 'b'.repeat(40),
    modelRepository: 'heartwise/DeepCORO_SYNTAX',
    modelRevision: 'c'.repeat(40),
    weightsPath: 'best_model.pt',
    weightsSha256: 'd'.repeat(64),
  },
  status,
  publishedAt: 1,
  active,
});

describe('inference model version selection', () => {
  it('selects the first available version that is not currently deployed', () => {
    const versions = [
      version('current', 'AVAILABLE', true),
      version('revoked', 'REVOKED'),
      version('rollback', 'AVAILABLE'),
    ];

    expect(getDefaultDeployableVersionId(versions)).toBe('rollback');
  });

  it('returns an empty selection when no version can be deployed', () => {
    const versions = [version('current', 'AVAILABLE', true), version('revoked', 'REVOKED')];

    expect(getDefaultDeployableVersionId(versions)).toBe('');
  });
});
