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
| `.webpack/webpack.base.js` | F14 (build ID), F2 (Turnstile key), F7 (processing flags): build-time defines | The define table and the returned config are local to this file; there is no plugin or config-merge entry point in the 3.11.1 build | `pacs-ai/build` as a separate webpack config merged on top (would need a new build script for every `build:*` target); environment variables alone (not exposed to the bundle without a define) | `0001-webpack-base-build-hook.patch` | yes (generic "load a local extend file" hook) | P1.3 |
| `platform/app/.webpack/webpack.pwa.js` | F14: `version.json` emission, no service-worker manifest, content-hashed CSS, `.env.example` defaults, COOP/COEP dev headers; app config read from `pacs-ai/config` | Plugins and dev-server settings are built inside the exported function; `APP_CONFIG` only selects a file under `platform/app/public` | `APP_CONFIG` alone (cannot point outside `public/`); copying `pacs-ai.js` into `public/config` before each build (a generated file inside an upstream directory) | `0002-webpack-pwa-build-hook.patch` | yes (same hook) | P1.3 |
| `rsbuild.config.ts` | F14 for `dev:fast`: `APP_BUILD_ID` define, `version.json`; app config read from `pacs-ai/config` | Same as `webpack.pwa.js`: the config object is built and exported in one expression | rsbuild `--config` with our own file (would duplicate the whole upstream config) | `0003-rsbuild-build-hook.patch` | yes (same hook) | P1.3 |
