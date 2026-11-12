import React, { useEffect, useState } from 'react';
import userRepository from '../../../../api/userRepository';
import { UserRole } from '../../../../api/userDTO';
import type { InferenceGPUModel } from '../../../../api/inferenceDTO';
import { useGPUInventory } from '../../hooks/useGPUInventory';
import type { UseInferenceModelsResult } from '../../hooks/useInferenceModels';
import ModelDeploymentProgressPanel from './ModelDeploymentProgressPanel';

const memory = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString()} MiB`
    : 'Unavailable';

type Props = { active: boolean; inference: UseInferenceModelsResult };

export default function GPUManagementPanel({ active, inference }: Props) {
  const [authorized, setAuthorized] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{
    model: InferenceGPUModel;
    gpuUuid: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setAuthorized(false);
    if (active) {
      userRepository
        .GetCurrentUser()
        .then(response => {
          if (!cancelled)
            setAuthorized(
              response.data.role === UserRole.OWNER || response.data.role === UserRole.ADMIN
            );
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [active]);
  const refreshKey = Object.values(inference.gpuDeployments || {})
    .map(item => `${item.modelId}:${item.progress.status}`)
    .join('|');
  const { inventory, stale, loading, error } = useGPUInventory(active && authorized, refreshKey);
  useEffect(() => {
    setConfirmation(null);
  }, [active]);
  if (!active || !authorized) return null;
  const canMove = Boolean(inventory?.managerEnabled && inventory?.managerReady && !stale && !error);
  const confirmMove = async () => {
    if (!confirmation || !canMove || inference.isModelDeploying(confirmation.model.modelId)) return;
    setSubmitError(false);
    try {
      await inference.moveGPU(
        confirmation.model.modelId,
        confirmation.gpuUuid,
        confirmation.model.containerId
      );
      setConfirmation(null);
    } catch (_error) {
      setSubmitError(true);
    }
  };
  return (
    <section
      aria-label="GPU management"
      className="mt-5 rounded-xl border border-white border-opacity-10 p-4 text-white"
    >
      <h2 className="text-lg">GPUs</h2>
      <p className="mt-1 text-sm text-white text-opacity-60">
        Updates every 5 seconds while this panel is visible.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-2 text-amber-300"
        >
          GPU status could not be refreshed. Displayed values are stale; GPU changes are disabled.
        </p>
      )}
      {!inventory && (
        <p className="mt-3">{loading ? 'Loading GPU status…' : 'GPU status unavailable'}</p>
      )}
      {inventory && (
        <>
          <p className="mt-2 text-xs text-white text-opacity-60">
            {stale ? 'Stale sample' : 'Last sample'}: {inventory.sampledAt}
            {' · '}
            {inventory.managerEnabled
              ? inventory.managerReady
                ? 'Scheduler ready'
                : 'Scheduler not ready'
              : 'Scheduler disabled'}
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {inventory.devices.map(device => {
              const physicalAvailable = !stale && device.telemetryStatus === 'available';
              const used = physicalAvailable ? device.usedMemoryMiB : null;
              const total = physicalAvailable ? device.totalMemoryMiB : null;
              const percent =
                typeof used === 'number' && typeof total === 'number' && total > 0
                  ? Math.min(100, Math.max(0, (used / total) * 100))
                  : null;
              return (
                <div
                  key={device.uuid}
                  className="rounded-lg bg-white bg-opacity-5 p-3"
                >
                  <h3 className="font-medium">{device.name || 'GPU'}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-white text-opacity-60">
                    {device.uuid}
                  </p>
                  <p className="mt-3 text-sm">
                    Device memory: {memory(used)} / {memory(total)}
                  </p>
                  {percent !== null && (
                    <div
                      role="progressbar"
                      aria-label={`${device.name || device.uuid} device memory`}
                      aria-valuenow={Math.round(percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-2 h-2 overflow-hidden rounded bg-white bg-opacity-10"
                    >
                      <div
                        className="h-full bg-[#C8F469]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                  {!physicalAvailable && (
                    <p className="mt-1 text-xs text-amber-300">
                      {stale ? 'Device telemetry is stale' : 'Device telemetry unavailable'}
                    </p>
                  )}
                  {physicalAvailable && (
                    <p className="mt-1 text-xs text-white text-opacity-60">
                      Free: {memory(device.freeMemoryMiB)} · Utilization:{' '}
                      {device.utilizationPercent === null
                        ? 'Unavailable'
                        : `${device.utilizationPercent}%`}
                    </p>
                  )}
                  <p className="mt-3 text-sm">
                    Scheduler reserved: {memory(device.managerReservedMiB)} /{' '}
                    {memory(device.managerCapacityMiB)}
                  </p>
                  <p className="mt-1 text-xs text-white text-opacity-60">
                    Scheduler available: {memory(device.managerAvailableMiB)}. Reservations are
                    separate from device usage.
                  </p>
                </div>
              );
            })}
          </div>
          {!inventory.devices.length && <p className="mt-3 text-sm">No GPUs configured.</p>}
          <div className="mt-4 space-y-3">
            {inventory.models.map(model => {
              const name =
                inference.models.find(item => item.id === model.modelId)?.name || 'Inference model';
              const selected =
                selections[model.modelId] || model.desiredGpuUuid || model.gpuUuid || '';
              const busy = inference.isModelDeploying(model.modelId);
              const selectedExists = inventory.devices.some(device => device.uuid === selected);
              const disabled = !canMove || !model.placementSupported || busy;
              const deployment = inference.gpuDeployments[model.modelId];
              return (
                <div
                  key={model.modelId}
                  className="border-t border-white border-opacity-10 pt-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[180px] flex-1">
                      <h3>{name}</h3>
                      <p className="mt-1 break-all text-xs text-white text-opacity-60">
                        Current: {model.gpuUuid || 'Unassigned'}
                      </p>
                    </div>
                    <label className="text-sm">
                      GPU
                      <select
                        aria-label={`GPU for ${name}`}
                        className="ml-2 max-w-[360px] rounded bg-[#1F221F] p-2"
                        value={selected}
                        disabled={disabled}
                        onChange={event =>
                          setSelections(previous => ({
                            ...previous,
                            [model.modelId]: event.target.value,
                          }))
                        }
                      >
                        {!selectedExists && (
                          <option value={selected}>{selected || 'Choose a GPU'}</option>
                        )}
                        {inventory.devices.map(device => (
                          <option
                            key={device.uuid}
                            value={device.uuid}
                          >
                            {device.name || 'GPU'} · {device.uuid}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="rounded bg-[#C8F469] px-3 py-2 text-sm text-black disabled:opacity-40"
                      disabled={disabled || !selectedExists || selected === model.gpuUuid}
                      onClick={() => {
                        setConfirmation({ model, gpuUuid: selected });
                        setSubmitError(false);
                      }}
                    >
                      {' '}
                      {busy ? 'Deploying…' : 'Move to GPU'}
                    </button>
                  </div>
                  {!model.placementSupported && (
                    <p className="mt-2 text-xs text-amber-300">
                      {model.reason || 'GPU placement is unavailable for this model.'}
                    </p>
                  )}
                  {deployment && <ModelDeploymentProgressPanel deployment={deployment} />}
                </div>
              );
            })}
          </div>
        </>
      )}
      {confirmation && (
        <div
          role="group"
          aria-label="Confirm GPU change"
          className="mt-4 rounded-lg border border-[#C8F469] p-4"
        >
          <h3>Move inference model to another GPU?</h3>
          <p className="mt-2 text-sm">
            This drains current inference and recreates the container on the selected GPU using the
            same model version. Deployment progress appears here.
          </p>
          <p className="mt-2 break-all font-mono text-xs">{confirmation.gpuUuid}</p>
          {submitError && (
            <p
              role="alert"
              className="mt-2 text-red-300"
            >
              GPU change could not be accepted. Refresh status and try again.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canMove || inference.isModelDeploying(confirmation.model.modelId)}
              onClick={confirmMove}
              className="rounded bg-[#C8F469] px-3 py-2 text-black disabled:opacity-40"
            >
              Confirm GPU change
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
