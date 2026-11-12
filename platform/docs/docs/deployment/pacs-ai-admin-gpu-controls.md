# Admin GPU controls

Open **Workspace Settings → Inference Models** as an owner or administrator. The GPU panel identifies physical devices by name and UUID. Container-local numeric GPU indices are not used as physical identities.

Device memory usage, total memory, free memory, and utilization come from telemetry. Scheduler reservations and capacity are shown separately: reservations include conservative inference headroom and are not measured device allocations. Missing telemetry is displayed as unavailable, never as zero. A failed refresh marks the inventory stale and disables placement changes.

The panel refreshes every five seconds after a completed request while its tab and browser document are visible. It cancels requests and releases timers when hidden or unmounted. Tenant changes and session-token rotation clear inventory, authorization, selections, confirmation, and deployment state; late responses from the previous session cannot restore them. A late accepted deployment remains durable on the server but cannot restart a UI monitor after unmount or attach to another session. Access is checked before GPU requests; the backend remains responsible for enforcing owner/admin permissions and tenant scope.

## Change GPU placement

Choose a target GPU beside a registered inference model and select **Move to GPU**. Confirming drains current inference and recreates the inference container using the same immutable model version. Docker device assignments cannot be changed in place. The existing deployment progress monitor reports stages, reconnect recovery, terminal failures, and rollback. A pending GPU move prevents a simultaneous version deployment for that model. Model data refreshes on successful completion.

Models without a supported placement contract show an unavailable reason. Placement requires a ready enabled manager, current inventory, and a different configured target device. The request includes the expected current container ID so concurrent changes fail safely.

## API contract

- `GET /v1/inference/gpus` returns sampled inventory, manager readiness, nullable device telemetry, per-device reservations, and tenant model placement support.
- `POST /v1/inference/model/{modelId}/gpu-placement` accepts `{gpuUuid, expectedContainerId}` and returns the standard accepted deployment operation.
- Existing deployment operation status and event routes provide progress. A same-version move is not an image release and does not change model weights or provenance.

## Verification

Run the focused frontend tests:

```sh
yarn jest --config platform/app/jest.config.js --runInBand useGPUInventory.test.tsx GPUManagementPanel.test.tsx useModelDeploymentProgress.test.tsx
```

Verify owner/admin access, user rejection, active-tab and document-visibility polling cleanup, unavailable/stale telemetry, measured-versus-reserved memory, explicit confirmation, expected container identity, and shared deployment progress. In a deployed browser, compare device memory with `nvidia-smi`, move a permitted idle model, and confirm the new container exposes the selected UUID while registration identity and prior inference history remain intact.
