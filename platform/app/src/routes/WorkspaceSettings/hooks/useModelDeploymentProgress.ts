import { useCallback, useEffect, useRef, useState } from 'react';
import inferenceRepository from '../../../api/inferenceRepository';
import type { InferenceModelDeploymentEvent } from '../../../api/inferenceDTO';
import {
  acceptedDeploymentProgress,
  isActiveModelDeployment,
  type ModelDeploymentConnectionMode,
  type TrackedModelDeployment,
} from '../inference-models/modelDeployment';
import {
  createModelDeploymentMonitor,
  type ModelDeploymentMonitor,
} from '../inference-models/modelDeploymentMonitor';
import {
  loadStoredModelDeployments,
  removeStoredModelDeployment,
  storeModelDeployment,
} from '../inference-models/modelDeploymentStorage';

type DeploymentMap = Record<string, TrackedModelDeployment>;

type UseModelDeploymentProgressOptions = {
  tenantId: string;
  onTerminal(modelId: string, event: InferenceModelDeploymentEvent): void;
};

export function useModelDeploymentProgress({
  tenantId,
  onTerminal,
}: UseModelDeploymentProgressOptions) {
  const [deployments, setDeployments] = useState<DeploymentMap>({});
  const [startingModels, setStartingModels] = useState<Record<string, boolean>>({});
  const monitorsRef = useRef(new Map<string, ModelDeploymentMonitor>());
  const startingModelsRef = useRef(new Set<string>());
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  const updateConnectionMode = useCallback(
    (modelId: string, connectionMode: ModelDeploymentConnectionMode) => {
      setDeployments(current => {
        const deployment = current[modelId];
        return deployment ? { ...current, [modelId]: { ...deployment, connectionMode } } : current;
      });
    },
    []
  );

  const startMonitor = useCallback(
    (modelId: string, deploymentId: string, initialProgress?: InferenceModelDeploymentEvent) => {
      monitorsRef.current.get(modelId)?.stop();
      storeModelDeployment(tenantId, { modelId, deploymentId });
      const progress =
        initialProgress ??
        ({
          deploymentId,
          status: 'PENDING',
          stage: 'resolve_active',
          sequence: 0,
          timestamp: Date.now(),
          elapsedMilliseconds: 0,
          terminal: false,
        } as const);
      setDeployments(current => ({
        ...current,
        [modelId]: { modelId, progress, connectionMode: 'connecting' },
      }));

      const monitor = createModelDeploymentMonitor(modelId, deploymentId, {
        onProgress: nextProgress => {
          setDeployments(current => ({
            ...current,
            [modelId]: {
              modelId,
              progress: nextProgress,
              connectionMode: current[modelId]?.connectionMode ?? 'connecting',
            },
          }));
        },
        onConnectionMode: mode => updateConnectionMode(modelId, mode),
        onTerminal: terminalProgress => {
          removeStoredModelDeployment(tenantId, modelId);
          monitorsRef.current.delete(modelId);
          onTerminalRef.current(modelId, terminalProgress);
        },
      });
      monitorsRef.current.set(modelId, monitor);
      monitor.start();
    },
    [tenantId, updateConnectionMode]
  );

  useEffect(() => {
    const restored = loadStoredModelDeployments(tenantId);
    restored.forEach(({ modelId, deploymentId }) => startMonitor(modelId, deploymentId));
    const monitors = monitorsRef.current;
    return () => {
      monitors.forEach(monitor => monitor.stop());
      monitors.clear();
    };
  }, [startMonitor, tenantId]);

  const deploy = useCallback(
    async (modelId: string, versionId: string) => {
      if (startingModelsRef.current.has(modelId) || isActiveModelDeployment(deployments[modelId])) {
        return deployments[modelId];
      }
      startingModelsRef.current.add(modelId);
      setStartingModels(current => ({ ...current, [modelId]: true }));
      try {
        const response = await inferenceRepository.DeployInferenceModelVersion(modelId, versionId);
        const progress = acceptedDeploymentProgress(response.data);
        startMonitor(modelId, response.data.deploymentId, progress);
        return { modelId, progress, connectionMode: 'connecting' } as TrackedModelDeployment;
      } finally {
        startingModelsRef.current.delete(modelId);
        setStartingModels(current => ({ ...current, [modelId]: false }));
      }
    },
    [deployments, startMonitor]
  );

  const isDeploying = useCallback(
    (modelId?: string) =>
      Boolean(
        modelId && (startingModels[modelId] || isActiveModelDeployment(deployments[modelId]))
      ),
    [deployments, startingModels]
  );

  return { deployments, deploy, isDeploying };
}
