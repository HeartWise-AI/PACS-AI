# Upstream patch ledger

Every edit to an upstream-owned file (anything outside the "ours" paths in
`docs/ohif-upgrade/PLAN.md` 6.1) that is meant to stay needs one row here and
one patch file under `pacs-ai/patches/`. The limit is 15 rows.

- `pacs-ai/scripts/check-upstream-drift.sh` reads the **File** column (one
  repository-relative path per row, in backticks) and the **Patch file**
  column (a file name under `pacs-ai/patches/`, or a repository-relative path).
- `pacs-ai/scripts/apply-patches.sh` applies the patch files in file-name order.
- Keep the table the first table in this file and the header row unchanged.

| File | Feature | Why no extension point works | Extension point considered | Patch file | Upstreamable | Owner / WP |
|---|---|---|---|---|---|---|
