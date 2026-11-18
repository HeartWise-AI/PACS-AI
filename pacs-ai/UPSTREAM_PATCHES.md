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
| `.webpack/webpack.base.js` | F14 (build ID), F2 (Turnstile key), F7 (processing flags): build-time defines | The define table and the returned config are local to this file; there is no plugin or config-merge entry point in the build (webpack in 3.11.1, rspack 2 from 3.13) | `pacs-ai/build` as a separate webpack config merged on top (would need a new build script for every `build:*` target); environment variables alone (not exposed to the bundle without a define) | `0001-webpack-base-build-hook.patch` | yes (generic "load a local extend file" hook) | P1.3 |
| `platform/app/.webpack/webpack.pwa.js` | F14: `version.json` emission, no service-worker manifest, content-hashed CSS, `pacs-ai/build/env.example` defaults (was `.env.example`), COOP/COEP dev headers; app config read from `pacs-ai/config` | Plugins and dev-server settings are built inside the exported function; `APP_CONFIG` only selects a file under `platform/app/public` | `APP_CONFIG` alone (cannot point outside `public/`); copying `pacs-ai.js` into `public/config` before each build (a generated file inside an upstream directory) | `0002-webpack-pwa-build-hook.patch` | yes (same hook) | P1.3 |
| `rsbuild.config.ts` | F14 for `dev:fast`: `APP_BUILD_ID` define, `version.json`; app config read from `pacs-ai/config` | Same as `webpack.pwa.js`: the config object is built and exported in one expression | rsbuild `--config` with our own file (would duplicate the whole upstream config) | `0003-rsbuild-build-hook.patch` | yes (same hook) | P1.3 |
| `extensions/default/src/DicomWebDataSource/utils/StaticWadoClient.ts` | F2 (images through the authenticated API proxy): bulk data URIs that point at the PACS directly (`http://orthanc:8042/...`) or at the API origin are rewritten to `<APP_PUBLIC_API_URL>/proxy/...` when retrieved | `retrieveBulkData` is a method of the client class the data source constructs internally; no hook sees the URI at request time. The data source's `bulkDataURI` config (`transform`, `startsWith`/`prefixWith`) is applied in `fixBulkDataURI` only, where a transformed absolute URI is kept only if it matches the single `startsWith` prefix, and not to URIs that reach `retrieveBulkData` without passing through it (OHIF issue 4256) | `bulkDataURI.transform` and `startsWith`/`prefixWith` in `pacs-ai.js`; `userAuthenticationService` (headers only, not URLs) | `0004-static-wado-bulkdata-proxy.patch` | no (retire at the 3.14 step: 3.14 applies `bulkDataURI.transform` to absolute URIs) | P2.6 |
| `.prettierignore` | F16 (tooling): Prettier, run by `lint-staged` and `yarn format`, formats only the "ours" paths, so the fork's difference from upstream stays real changes (P1.1 reverted 91 formatting-only edits) | Prettier reads one ignore file, the root `.prettierignore`; there is no per-directory ignore file or config key for it | `--ignore-path pacs-ai/...` in our scripts (editors and other Prettier runs would still read the root file); a narrower `lint-staged` glob alone (already done; does not cover `yarn format` or editors) | `0005-prettierignore-ours-only.patch` | no | P2.7 |
| `platform/app/.env` | F14: the deployment's build environment (API base URL for `env-config.js`, Turnstile site key) lives in this file, untracked; upstream tracks it with development defaults | `pacs-ai/build/generate-env-config.js` and `extend.js` (dotenv, for the `process.env.*` defines) read this path; tracking upstream's file at the same path as each deployment's local, secret-bearing file would let `git checkout` overwrite it and `git add` commit it | reading the environment from a git-ignored file under `pacs-ai/` (changes every deployment's build input; planned with the rspack port, PLAN P3.1 rule 6 and P3.2) | `0006-app-env-untracked.patch` | no | P2.7 |
| `platform/app/.gitignore` | F14: keeps `platform/app/.env` (previous row) untracked | git ignore rules apply per directory; the root `.gitignore` is upstream too | `.git/info/exclude` (per clone, not shared) | `0007-app-env-gitignore.patch` | no | P2.7 |

## Re-applied on v3.13.14 (P3.1)

All seven patches were re-applied after the merge of OHIF v3.13.14 and are
now made against `refs/upstream/v3.13.14`
(`apply-patches.sh --fresh --check`: 7 applied, 0 conflicts). 0001, 0004, 0005
and 0007 applied unchanged (0001 regenerated for its index line and hunk offset only);
0002 (`webpack.pwa.js`, hook moved to the new end of the function), 0003
(`rsbuild.config.ts`, same hook on the reworked config) and 0006 (upstream's
new `.env` content) were regenerated. None retired: the build hooks (0001 to
0003) now sit in rspack/rsbuild configs and `pacs-ai/build/extend.js` is
ported to rspack in P3.2; 0004 retires at the 3.14 step. On a working tree
that holds the deployment's untracked `platform/app/.env`, `apply-patches.sh`
reports 0006 as a conflict; that is expected (the patch only untracks the
file).

## rspack port (P3.2)

`pacs-ai/build/extend.js` now extends the rspack 2 configs of OHIF 3.13.14
(`CopyRspackPlugin`, `HtmlRspackPlugin`, `CssExtractRspackPlugin`, upstream's
`InjectServiceWorkerManifestPlugin`) and loads `platform/app/.env` itself with
dotenv, since upstream dropped `dotenv-webpack`. The hooks in 0001 to 0003 did
not change, so no patch was regenerated.
