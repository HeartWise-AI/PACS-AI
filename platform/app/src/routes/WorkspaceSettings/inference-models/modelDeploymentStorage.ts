const MODEL_DEPLOYMENT_STORAGE_PREFIX = 'pacs-ai:model-deployments:';

export interface StoredModelDeployment {
  modelId: string;
  deploymentId: string;
}

function storageKey(tenantId: string): string {
  return `${MODEL_DEPLOYMENT_STORAGE_PREFIX}${tenantId}`;
}

export function loadStoredModelDeployments(tenantId: string): StoredModelDeployment[] {
  if (!tenantId) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(tenantId)) || '[]');
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (entry): entry is StoredModelDeployment =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as StoredModelDeployment).modelId === 'string' &&
        typeof (entry as StoredModelDeployment).deploymentId === 'string' &&
        Boolean((entry as StoredModelDeployment).modelId) &&
        Boolean((entry as StoredModelDeployment).deploymentId)
    );
  } catch {
    return [];
  }
}

export function storeModelDeployment(tenantId: string, deployment: StoredModelDeployment): void {
  if (!tenantId) {
    return;
  }
  const deployments = loadStoredModelDeployments(tenantId).filter(
    entry => entry.modelId !== deployment.modelId
  );
  deployments.push(deployment);
  localStorage.setItem(storageKey(tenantId), JSON.stringify(deployments));
}

export function removeStoredModelDeployment(tenantId: string, modelId: string): void {
  if (!tenantId) {
    return;
  }
  const deployments = loadStoredModelDeployments(tenantId).filter(
    entry => entry.modelId !== modelId
  );
  if (deployments.length === 0) {
    localStorage.removeItem(storageKey(tenantId));
  } else {
    localStorage.setItem(storageKey(tenantId), JSON.stringify(deployments));
  }
}
