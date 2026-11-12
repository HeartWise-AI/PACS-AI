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
  sessionScope?: string;
  scopeIsCurrent?: () => boolean;
  onTerminal(modelId: string, event: InferenceModelDeploymentEvent): void;
};

export function useModelDeploymentProgress({
  tenantId,
  sessionScope = tenantId,
  scopeIsCurrent = () => true,
  onTerminal,
}: UseModelDeploymentProgressOptions) {
  const scopeKey = `${tenantId}:${sessionScope}`;
  const [stateScope, setStateScope] = useState(scopeKey);
  const [storedDeployments, setDeployments] = useState<DeploymentMap>({});
  const [storedStartingModels, setStartingModels] = useState<Record<string, boolean>>({});
  const deployments = stateScope === scopeKey ? storedDeployments : {};
  const startingModels = stateScope === scopeKey ? storedStartingModels : {};
  const lifecycleRef = useRef({ scopeKey, mounted: false });
  if (lifecycleRef.current.scopeKey !== scopeKey) {
    lifecycleRef.current.mounted = false;
    lifecycleRef.current = { scopeKey, mounted: false };
  }
  const scopeIsCurrentRef = useRef(scopeIsCurrent);
  scopeIsCurrentRef.current = scopeIsCurrent;
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
      const lifecycle = lifecycleRef.current;
      const valid = () =>
        lifecycle === lifecycleRef.current && lifecycle.mounted && scopeIsCurrentRef.current();
      if (!valid()) return;
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
          if (!valid()) return;
          setDeployments(current => ({
            ...current,
            [modelId]: {
              modelId,
              progress: nextProgress,
              connectionMode: current[modelId]?.connectionMode ?? 'connecting',
            },
          }));
        },
        onConnectionMode: mode => {
          if (valid()) updateConnectionMode(modelId, mode);
        },
        onTerminal: terminalProgress => {
          if (!valid()) return;
          removeStoredModelDeployment(tenantId, modelId);
          monitorsRef.current.delete(modelId);
          onTerminalRef.current(modelId, terminalProgress);
        },
      });
      monitorsRef.current.set(modelId, monitor);
      monitor.start();
    },
    [tenantId, scopeKey, updateConnectionMode]
  );

  useEffect(() => {
    // A fresh ownership object also invalidates work across effect teardown
    // and reactivation of the same session (including Strict Mode cleanup).
    const lifecycle = { scopeKey, mounted: true };
    lifecycleRef.current = lifecycle;
    setDeployments({});
    setStartingModels({});
    setStateScope(scopeKey);
    startingModelsRef.current.clear();
    const restored = scopeIsCurrentRef.current() ? loadStoredModelDeployments(tenantId) : [];
    restored.forEach(({ modelId, deploymentId }) => startMonitor(modelId, deploymentId));
    const monitors = monitorsRef.current;
    return () => {
      lifecycle.mounted = false;
      const sessionChanged = lifecycle !== lifecycleRef.current || !scopeIsCurrentRef.current();
      monitors.forEach((monitor, modelId) => {
        monitor.stop();
        if (sessionChanged) removeStoredModelDeployment(tenantId, modelId);
      });
      monitors.clear();
    };
  }, [startMonitor, tenantId, scopeKey]);

  const submitDeployment = useCallback(
    async (
      modelId: string,
      submit: () => ReturnType<typeof inferenceRepository.DeployInferenceModelVersion>
    ) => {
      const lifecycle = lifecycleRef.current;
      const valid = () =>
        lifecycle === lifecycleRef.current && lifecycle.mounted && scopeIsCurrentRef.current();
      if (!valid()) return undefined;
      if (startingModelsRef.current.has(modelId) || isActiveModelDeployment(deployments[modelId])) {
        return deployments[modelId];
      }
      startingModelsRef.current.add(modelId);
      setStartingModels(current => ({ ...current, [modelId]: true }));
      try {
        const response = await submit();
        // The server operation is durable. A late acceptance must not revive a
        // monitor or write recovery state after navigation or a session switch.
        if (!valid()) return undefined;
        const progress = acceptedDeploymentProgress(response.data);
        startMonitor(modelId, response.data.deploymentId, progress);
        return { modelId, progress, connectionMode: 'connecting' } as TrackedModelDeployment;
      } finally {
        if (valid()) {
          startingModelsRef.current.delete(modelId);
          setStartingModels(current => ({ ...current, [modelId]: false }));
        }
      }
    },
    [deployments, startMonitor]
  );

  const deploy = useCallback(
    (modelId: string, versionId: string) =>
      submitDeployment(modelId, () =>
        inferenceRepository.DeployInferenceModelVersion(modelId, versionId)
      ),
    [submitDeployment]
  );

  const moveGPU = useCallback(
    (modelId: string, gpuUuid: string, expectedContainerId: string) =>
      submitDeployment(modelId, () =>
        inferenceRepository.SetInferenceModelGPUPlacement(modelId, gpuUuid, expectedContainerId)
      ),
    [submitDeployment]
  );

  const isDeploying = useCallback(
    (modelId?: string) =>
      Boolean(
        modelId && (startingModels[modelId] || isActiveModelDeployment(deployments[modelId]))
      ),
    [deployments, startingModels]
  );

  return { deployments, deploy, moveGPU, isDeploying };
}
