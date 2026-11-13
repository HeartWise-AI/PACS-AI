# Release candidates for agents

Read this when preparing a candidate, rebuilding after a fix, checking staging evidence,
or proposing production promotion. Run the tool from a clean checkout of the reviewed
production branch. Python 3.12+, Git and an authenticated `gh` are required.

## Current activation state

Candidate preparation, immutable branch creation and build packaging are implemented.
Staging deployment and production promotion are **blocked by default** in
`tools/release/policy.json`. No isolated deployment adapter or production approval
configuration is assumed. The build workflow produces **build-only** artifacts. Its
success is never sufficient to promote. The tooling tests simulate GitHub and staging;
they do not validate a real deployment.

A human must review and merge the tooling first, including the matching policy in each
paired repository. Commands load policy from every current production branch and reject
local policy overrides. Keep broader inventory, credentials and clinical data outside
this repository. This tool never merges, approves, enables auto-merge or dispatches a
deployment. Do not invoke existing production deployment scripts as a shortcut.

The policy currently proposes the repository default branches as promotion targets.
Each repository also has an older `production` branch. The serving runtime was not
audited, so these targets are not evidence of the branch currently deployed. Confirm
and review the intended branch mapping before activation; the CLI also supports an
explicitly configured `production` target.

## Prepare and package

Open the application change PRs against the production branches in the policy.
Bring each source PR up to date with its production base. Same-repository components
must use the same PR. Fork source PRs are rejected.
Snapshot both source commits using a new lowercase candidate ID:

```sh
python3 tools/release/release.py prepare --id rc-20261113-1 \
  --frontend-pr 123 --backend-pr 456 --output candidate.json
python3 tools/release/release.py candidate --manifest candidate.json
```

`candidate.json` is local input. Keep it outside the clean checkout used for builds.
The CLI creates `staging-release-rc-20261113-1` in each paired repository with a
single packaging commit. That commit adds `.release/candidate.json`; application
content comes unchanged from the source commit. Repeat calls reuse identical refs
and reject divergent refs. Partial cross-repository creation can be retried. No
existing ref is updated or deleted. Keep source PRs open until their promotion is merged.
After a human approves the build run, manually run **Agent candidate build only**
on the candidate branch in each repository. This does not deploy. It uses native
Dockerfiles on GitHub-hosted runners with no registry publication or secrets.
Images are exported with image IDs, archive checksums, source SHA and run identity.
Inspect `tools/release/build.json` for covered images and outstanding prerequisites.
These synthetic build settings are not production configuration.

Any source change, unrelated production-base movement or policy change requires a **new ID** and
new builds/tests. Never force-update a candidate. Packaging SHAs and application SHAs
are different; the manifest records the latter. Production must eventually consume
verified image digests, not rebuild from the packaging commit or use `latest`.

## Verify and propose

The staging deployment adapter is not supplied in this change because isolated resources
and authentication have not been established. Enabling the policy alone does not create
one. Complete every activation prerequisite below before enabling it.

The evidence input contains IDs only, keyed by repositories from policy:

```json
{
  "owner/frontend": {"run_id": 12345, "deployment_id": 23456},
  "owner/backend": {"run_id": 34567, "deployment_id": 45678}
}
```

Use one entry for a monorepo. A `passed: true` field is rejected.

```sh
python3 tools/release/release.py verify --manifest candidate.json --evidence evidence.json
python3 tools/release/release.py promote --manifest candidate.json --evidence evidence.json
```

A successful verification reads live GitHub data and outputs only identifiers and digests.
Promotion rechecks both components before creating each **draft** PR into its own true
production branch (`main` or `master`). It never merges. Existing identical draft PRs
are reused; a PR already handed to a human is not changed. A failure does not roll back
previously created candidate refs or draft PRs. Review their state before retrying.

For paired repositories, one human-reviewed promotion may merge before the other. The
gate accepts that transition only when the current production SHA is exactly the merged
promotion result, its tree equals the tested candidate, and an independent human approved
that exact head. It can resolve a candidate branch deleted automatically after merge from
that verified PR. The source PR may then be marked merged. Any later production commit,
changed merge tree or missing approval blocks the remaining promotion.

## Activation prerequisites for maintainers

- Provide a reviewed staging workflow at the policy's exact path. Keep workflow and all
  deployment/verifier dependencies in `trusted_paths`. The candidate must contain the
  same bytes as the reviewed production base. Do not execute untrusted application code
  in a job holding deployment credentials; separate unprivileged builds from deployment.
- Provision per-candidate environments named `agent-staging-<id>`, with resources and
  credentials isolated from production, synthetic data only and no patient data in logs.
  GitHub environment names alone do not prove resource isolation. The adapter must make
  that guarantee and test it. Concurrent IDs must use different resources; same-ID runs
  must serialize through deployment and E2E. Publish no success until E2E finishes and
  the deployed image digests are reread from the runtime.
- Run the expected jobs via `workflow_dispatch` by an allowlisted human, on the exact
  candidate SHA. All expected jobs and steps must succeed; skipped jobs/steps, reruns,
  cancellation and stale evidence fail. The adapter must test the paired FE/BE manifest,
  including all supporting services, and deploy immutable image digests.
- Upload a small artifact named `staging-evidence-<manifest SHA-256>`. Its ZIP contains
  exactly `evidence.json`: `manifest_sha256`, integer `run_id`, `run_attempt: 1`, and
  `images` mapping every policy image name to its immutable SHA-256 image digest.
  No clinical payload, logs, credentials, hostname or infrastructure path belongs here.
- Create a transient, non-production GitHub deployment at the exact candidate SHA and
  environment, task `deploy`, using GitHub Actions. Its payload contains the attestation
  plus `artifact_id` and `artifact_digest` from the upload. The latest deployment status
  must be success, by GitHub Actions, with `log_url` equal to the exact run URL. The gate
  downloads the artifact and checks its ZIP digest and payload. A newer deployment to
  that environment invalidates the evidence.
- Configure a `production` GitHub environment with independent human reviewers,
  prevent-self-review and no administrator bypass. Require fresh PR approval and the
  strict, GitHub Actions-backed `Release promotion gate` status on production branches.
  That required gate **is not installed by these tooling-test workflows**. It must run
  trusted verifier code on current paired state immediately before human merge. Audit
  ruleset bypass actors and restrict them separately. The CLI cannot revoke admin rights
  or make a cross-repository PR merge atomic.
- Wire production delivery through that protected environment to consume exactly the
  staged image digests. Retain artifacts through approval and rollback; the illustrative
  build-only artifacts expire after three days. Configure least-privilege cross-repository
  read access when needed; the default GITHUB_TOKEN may not read a paired private repo.
  Do not create a broad PAT to work around this.

The CLI's approval preflight checks that controls exist, but is not a server-side merge
lock. Source or deployment state can change after it returns. A trusted required gate,
protected production delivery, and the human's final verification remain essential.
A source PR merged directly to production can bypass this proposed path unless the
maintainer's required gate rejects it. Report that enforcement separately.

## Recovery and verification

If a candidate fails, fix the source PR, choose a new ID, rebuild and retest both parts.
Retain failed IDs and their evidence for audit; cleanup is a separate human operation.
Rollback requires a previously tested immutable image/task revision and human approval
through the actual deployment system. The tool does not run migrations or roll them back.
PACS uses existing Compose deployment; pin previously verified image digests before a
human restarts the intended isolated stack. Never reuse production mounts or credentials
for staging. Runtime verification and data-compatible rollback must precede activation.

Run the tooling contract suite:

```sh
python3 -m unittest discover -s tools/release/tests -v
```

Tests execute the CLI against temporary Git repositories and a local fake `gh`, covering
both successful preparation/promotion and rejection cases. They need no GitHub token,
Docker daemon, infrastructure, model weights or patient data.
