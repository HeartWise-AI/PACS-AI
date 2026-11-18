# Paired staging release validation

Keep frontend and backend candidate PRs open against matching
`staging-release-*` branches until the paired application is tested. The staging
workflow tests draft PRs on GitHub-hosted runners without deployment secrets or
production runner access. It checks out the exact candidate commit and installs
the committed dependency lockfile. It does not deploy or promote a release.

Record the frontend/backend candidate SHAs, runtime artifacts and model image in
one acceptance record. A staging branch does not create a staging environment:
use an isolated stack with synthetic studies and separate services, or obtain a
controlled maintenance test window.

The worklist acceptance must cover authentication and model/config reads,
scheduled discovery/retrieval, study-service dispatch, Celery execution, correlated
results/callbacks and tenant-scoped worklist REST/SSE transitions. Confirm the UI
can display GPU admission unavailability while the API remains available, then
queued/running/completed and failed states after recovery. Verify refresh,
reconnection, tenant isolation, result rendering and rollback with the same
backend/frontend pair.

The detailed incident, MedGemma artifact prerequisites and acceptance table live
in backend `docs/automatic-inference-recovery-2026-11-13.md`. Static tests alone do
not approve production promotion. After acceptance, merge candidates into their
staging branches and open paired promotion PRs to frontend `main` and backend
`master`. A changed candidate SHA requires renewed acceptance. Preserve previous
images and registrations/history for rollback; clinical job replay requires a
separate explicit selection and deduplication review.
