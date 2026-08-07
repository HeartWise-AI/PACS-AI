---
sidebar_position: 12
sidebar_label: PACS-AI real-time worklist
title: PACS-AI Real-Time Worklist Rollout
summary: Staged enablement, verification, rollback, and polling-retirement procedure for tenant-scoped processing status on the PACS-AI worklist.
---

# PACS-AI real-time worklist rollout

This runbook covers the frontend rollout of tenant-scoped processing summaries, lazy run
history, authenticated server-sent events (SSE), processing notifications, and authorized
manual study reprocessing.

REST is authoritative. SSE reduces update latency but has no durable replay; reconnect recovery
must reload the REST snapshot for only the studies visible on the current worklist page.

## Ownership and prerequisites

The release owner must confirm the following before enabling the feature outside a test tenant:

- Backend REST, SSE, Redis fan-out, reconciliation, legacy backfill, and reprocessing changes from
  `pacs-ai-backend#251` are deployed.
- Database migrations and the `LEGACY_IMPORT` backfill verification from
  `pacs-ai-backend#252` are complete.
- Nginx forwards `/v1/inference/worklist/events` without response buffering and allows a
  connection to remain open longer than the heartbeat interval.
- An owner/admin account and a non-authorized account are available.
- Two isolated tenants are available, including a study known to exist in only one tenant.
- The release owner, backend owner, frontend owner, and rollback decision-maker are recorded in
  the change ticket.

Do not place bearer tokens, tenant IDs, Study Instance UIDs, patient information, DICOM metadata,
or inference payloads in the change ticket or test output.

## Runtime controls

Production configuration is read from `window.config.studyProcessing`. It can be changed in the
deployed `app-config.js` without rebuilding the frontend. Build-time environment variables remain
fallbacks when a runtime value is omitted.

| Runtime property | Environment fallback | Purpose | Dependency |
| --- | --- | --- | --- |
| `processingUIEnabled` | `APP_PUBLIC_STUDY_PROCESSING_UI_ENABLED` | Master processing columns and protected frontend state | Owner/admin role |
| `restSnapshotsEnabled` | `APP_PUBLIC_STUDY_PROCESSING_REST_ENABLED` | Visible-study authoritative summaries | Processing UI |
| `runHistoryEnabled` | `APP_PUBLIC_STUDY_PROCESSING_HISTORY_ENABLED` | Lazy history and model execution details | REST |
| `realtimeSSEEnabled` | `APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED` | Live status stream and reconnect recovery | REST |
| `studyEventNotificationsEnabled` | `APP_PUBLIC_STUDY_PROCESSING_NOTIFICATIONS_ENABLED` | SSE-derived toast and bell transitions | SSE |
| `manualReprocessingEnabled` | `APP_PUBLIC_STUDY_PROCESSING_REPROCESS_ENABLED` | Confirmed full-study reprocessing | REST and history |
| `candidatePollingEnabled` | `APP_PUBLIC_CANDIDATE_PROCESSING_POLL_ENABLED` | Temporary notification fallback | Processing UI |
| `fixturePreviewEnabled` | `APP_PUBLIC_STUDY_PROCESSING_FIXTURES_ENABLED` | Explicit fixture preview for development | Processing UI; keep `false` in production |

Disabling an upstream capability automatically disables its dependents. For example, disabling
REST stops history, reprocessing, SSE, and SSE notifications even if their individual flags remain
`true`. Disabling the processing UI releases connections and clears protected summaries, history,
reprocessing state, notification metadata, and deduplication state.

## Staged enablement

Change one stage at a time. Record the start time, configuration, test tenant, observations, and
approval before advancing.

### Stage 0: disabled baseline

```js
studyProcessing: {
  processingUIEnabled: false,
  restSnapshotsEnabled: false,
  runHistoryEnabled: false,
  realtimeSSEEnabled: false,
  studyEventNotificationsEnabled: false,
  manualReprocessingEnabled: false,
  candidatePollingEnabled: true,
  fixturePreviewEnabled: false,
}
```

Confirm the existing Orthanc search, modality filter, pagination, row expansion, viewer, and
segmentation actions behave normally.

### Stage 1: REST summaries

Enable `processingUIEnabled` and `restSnapshotsEnabled` for the test environment.

Verify:

- Only owner/admin users see processing columns or make protected processing requests.
- Each request contains repeated `studyInstanceUID` filters only for the current page.
- No request contains a client-selectable `tenantId`.
- Retrieval-only, active, terminal, attention, unavailable, and error states render safely.
- Changing page, sorting, or searching never attaches one study's state to another row.

### Stage 2: lazy history and reprocessing

Enable `runHistoryEnabled`, then `manualReprocessingEnabled`.

Verify:

- Expanding one study requests history for only that Study Instance UID.
- The history response's included executions are used without N+1 run-detail requests.
- Cached history is reused until the operator explicitly refreshes it.
- Legacy runs retain nullable fields and do not imply reconstructed attempts.
- Reprocessing requires confirmation, sends one request, preserves older history, and shows the
  newly created manual run first.
- Active-run conflict (`409`) refreshes status without clearing history.

### Stage 3: SSE with REST recovery

Enable `realtimeSSEEnabled` while leaving candidate polling enabled as a rollback source.

Verify:

- One authenticated stream opens per authorized frontend session.
- The URL contains no token, tenant ID, user ID, or study identifier.
- The response is `text/event-stream`, includes `X-Accel-Buffering: no`, immediately sends
  `: connected`, and sends `: heartbeat` approximately every 20 seconds.
- A processing event updates the correct row without a page refresh.
- Equal-version, duplicate, and out-of-order events do not regress state or duplicate
  notifications.
- Disconnecting preserves cached status as stale; reconnecting refreshes only visible studies
  through REST before normal live updates continue.
- Logout, authorization loss, tenant/user change, feature disablement, and unmount close the
  stream and clear protected state.

### Stage 4: SSE notifications

Enable `studyEventNotificationsEnabled`.

Verify:

- Initial and reconnect REST snapshots never produce a toast storm.
- One terminal transition and one independent attention transition produce at most one
  notification each.
- Notification navigation locates and expands the exact worklist study.
- Missing visible metadata uses translated generic labels.
- Candidate polling does not simultaneously own notifications while SSE notifications are active.

## Automated deployed verification

The opt-in Playwright suite is `tests/StudyProcessingRollout.spec.ts`. It never stores credentials
in the repository and disables traces and videos so bearer credentials cannot enter artifacts.

Provide secrets through the secure CI secret store:

```text
PACS_AI_E2E_BASE_URL
PACS_AI_E2E_OWNER_STORAGE_STATE
PACS_AI_E2E_OWNER_TOKEN
PACS_AI_E2E_VISIBLE_STUDY_UID
PACS_AI_E2E_TENANT_A_TOKEN
PACS_AI_E2E_TENANT_B_TOKEN
PACS_AI_E2E_TENANT_A_ONLY_STUDY_UID
```

Run:

```bash
yarn test:e2e:ci tests/StudyProcessingRollout.spec.ts
```

The suite verifies:

- bounded REST status followed by lazy history in the browser;
- the same route cannot expose a tenant-A-only study to tenant B; and
- the deployed SSE path immediately flushes its connection comment and later heartbeat.

Delete temporary storage-state files after verification. Never upload them as build artifacts.

## Health signals and privacy

Frontend telemetry is capped at 100 events per adapter and contains only allowlisted values:

- SSE connection state;
- retry attempt and bounded delay;
- invalid-event count;
- sanitized connection error category and supported HTTP status;
- sanitized REST snapshot failure category;
- run-history availability category and retryability; and
- candidate fallback activation reason.

Telemetry must never include tokens, tenant/user IDs, Study Instance UIDs, patient data, DICOM
metadata, inference results, complete backend payloads, or raw backend errors.

Backend dashboards should be checked for SSE connections and publish failures, reconciliation,
callback outcomes and latency, duplicate/out-of-order events, active phases, outcomes, skips, and
attention reasons. Use opaque run correlation permitted by the backend runbook; do not log DICOM
contents or inference results.

## Rollback triggers and actions

| Trigger | Immediate action | Preserved capability |
| --- | --- | --- |
| Duplicate notifications or bad deep links | Disable `studyEventNotificationsEnabled` | REST, history, reprocessing, SSE status |
| Reconnect storm or proxy buffering | Disable `realtimeSSEEnabled` | REST-authoritative UI; candidate notification fallback |
| History endpoint errors or excessive detail traffic | Disable `runHistoryEnabled` and `manualReprocessingEnabled` | Aggregate REST/SSE status |
| Reprocessing errors or operator-safety concern | Disable `manualReprocessingEnabled` | Read-only status and history |
| REST authorization, tenant, or row-association concern | Disable `restSnapshotsEnabled` | Existing non-processing worklist |
| Any protected-data isolation concern | Disable `processingUIEnabled` immediately | Existing Orthanc worklist only |

After changing runtime configuration, reload an authorized browser and confirm disabled transports
are released and protected caches are empty. A backend or proxy incident may also require backend
rollback; follow the backend real-time worklist runbook before restoring frontend flags.

## Candidate-polling retirement

Keep `candidatePollingEnabled` available for a defined compatibility window. Disable and later
remove it only after the release owner approves evidence that:

- REST summaries and lazy history are stable for the agreed observation period;
- SSE remains unbuffered across multiple heartbeat intervals and reconnect recovery passes;
- multi-instance Redis fan-out works without crossing tenants;
- terminal and attention notifications are deduplicated;
- legacy backfill produces no snapshot-driven toast storm;
- owner/admin authorization and two-tenant isolation pass;
- snapshot, history, SSE, and fallback telemetry are within agreed thresholds; and
- operations has exercised the SSE-off rollback with candidate notifications restored.

First set `candidatePollingEnabled: false` while retaining the code path for one release window.
Removal of the polling implementation requires a separate reviewed change after the compatibility
window closes.

## Evidence record

Attach a privacy-safe record to the change ticket:

```text
Frontend commit/image:
Backend commit/image:
Runtime flag stage:
Environment:
Verification start/end:
REST visible-study filtering: pass/fail
Lazy history and no N+1: pass/fail
SSE connected/heartbeat/unbuffered: pass/fail
Reconnect REST recovery: pass/fail
Legacy import rendering: pass/fail
Manual reprocessing/history preservation: pass/fail
Owner/admin authorization: pass/fail
Two-tenant isolation: pass/fail
Existing worklist regression: pass/fail
Telemetry privacy review: pass/fail
Rollback exercise: pass/fail
Candidate-polling decision:
Approvers:
```

Use opaque test-case references instead of protected identifiers in this record.
