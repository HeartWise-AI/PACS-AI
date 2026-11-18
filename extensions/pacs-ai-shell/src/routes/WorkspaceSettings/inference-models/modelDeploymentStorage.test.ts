import {
  loadStoredModelDeployments,
  removeStoredModelDeployment,
  storeModelDeployment,
} from './modelDeploymentStorage';

describe('model deployment refresh recovery storage', () => {
  afterEach(() => localStorage.clear());

  test('keeps active deployment identities isolated by tenant and model', () => {
    storeModelDeployment('tenant-a', { modelId: 'model-a', deploymentId: 'deployment-1' });
    storeModelDeployment('tenant-a', { modelId: 'model-b', deploymentId: 'deployment-2' });
    storeModelDeployment('tenant-b', { modelId: 'model-a', deploymentId: 'deployment-3' });

    expect(loadStoredModelDeployments('tenant-a')).toEqual([
      { modelId: 'model-a', deploymentId: 'deployment-1' },
      { modelId: 'model-b', deploymentId: 'deployment-2' },
    ]);
    expect(loadStoredModelDeployments('tenant-b')).toEqual([
      { modelId: 'model-a', deploymentId: 'deployment-3' },
    ]);
  });

  test('replaces a model operation and removes it after a terminal result', () => {
    storeModelDeployment('tenant-a', { modelId: 'model-a', deploymentId: 'old' });
    storeModelDeployment('tenant-a', { modelId: 'model-a', deploymentId: 'new' });

    expect(loadStoredModelDeployments('tenant-a')).toEqual([
      { modelId: 'model-a', deploymentId: 'new' },
    ]);

    removeStoredModelDeployment('tenant-a', 'model-a');
    expect(loadStoredModelDeployments('tenant-a')).toEqual([]);
  });

  test('ignores malformed stored values', () => {
    localStorage.setItem('pacs-ai:model-deployments:tenant-a', '{broken');
    expect(loadStoredModelDeployments('tenant-a')).toEqual([]);
  });
});
