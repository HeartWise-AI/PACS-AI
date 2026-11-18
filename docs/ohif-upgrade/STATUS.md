# OHIF upgrade status

Plan: `docs/ohif-upgrade/PLAN.md`. One line per work package. States: todo, running, done, blocked.

## Decisions (P0.2)

| # | Decision | Value | Source |
|---|---|---|---|
| D1 | Target | OHIF 3.13.14 (`e4cd86153`); still the newest stable 3.13 tag on 2026-11-17 | user |
| D2 | Modularize before the upgrade | yes (phases 1–2 on 3.11.1) | plan default |
| D3 | Stock features the fork dropped | flags off in `pacs-ai.js`; investigational-use dialog stays hidden (raised to the user 2026-11-17; the user delegated the decision) | plan default |
| D4 | Work list | ours, as a custom route | plan default |
| D5 | Upstream theme dialog | hidden | plan default |
| D6 | `useNextViewports` | off | plan default |
| D7 | Orchestrator | **Claude Opus 5.5** from 2026-11-17 (user: "start it with opus"); the plan was written with Fable 5.2, which is rate-limited until 2026-11-22 | user |

## Authorization (user, 2026-11-17)

"Nobody's using PACS-AI on their current computer, so you can hack it, you can rebuild the Docker images with the new ones. You can do all the tests with Playwright. I give you permission. The code base is yours."

This relaxes R1 and R2 for this migration: the orchestrator may build and deploy migration builds of the viewer to the MHI server, run the Playwright suites there, and merge integration work when its gates pass. Still kept: deploy at idle moments, check login after every deploy, keep the previous image for rollback, never touch the model gateway, study-service or ingestion jobs as part of the migration (automatic AI runs on new exams continue), no patient data in the repository.

## Baseline at P1.4 (integration/modular-3.11 @ 0132362c0)

- Type errors (G2): 1843
- Unit tests (G3): 216 suites / 1712 tests, all passing (core 28/261, extension-default 7/27, app 181/1424)
- Modified upstream files: 299 (after P1.1: 196)
- Gate note: in containers set only `NODE_EXTRA_CA_CERTS` for the local CA; setting yarn's `cafile` to it alone breaks `yarn install`.

## Work packages

| WP | State | PR / commit | Notes |
|---|---|---|---|
| P1.4 | done | `integration/modular-3.11` @ c814f5ea1 | Tree identical to `origin/main` 374c64929 before the `UPSTREAM_REF` commit; merge-base with v3.13.14 = 974ef29aa. Needed `--allow-unrelated-histories` (add to the plan's command). |
| P0.2 | done | this file | |
| P0.1 | done | #509 | 17 specs under `tests/pacs-ai/`. Live run 50 pass / 6 fail / 15 skip; findings: viewport action bar "Series:" label missing (already gone on main, F15), AI Predictions compare fails when earlier results expired, reference studies' stored results expired (24 h retention), PACS refresh of a 47-series study timed out. Runner: self-hosted `pacs-ai-mhi` + environment `pacs-ai-acceptance` still to set up. |
| P1.1 | done | `wp/P1.1-revert-formatting` | Modified upstream files 299 → 196 (91 formatting-only reverts, 13 docs restores; +1 `.prettierignore`); 3 stale mode `index.js` deleted. Baseline on `integration/modular-3.11` @ 0132362c0: G1 ok; G2 1843 type errors; G3 216 suites / 1712 tests, all passing. After: same (1843; 216 / 1712). Kept `platform/docs/package.json` + `yarn.lock` (dependabot bump #475). |
| P1.2 | done | #504 | drift guard and ledger; exit check met (script runs and prints the counts). Report vs v3.11.1: 1024 modified upstream files, 58 theme-debt files, 0 ledger rows; 952 unexplained, 14 expected, 57 import violations (all `@ohif/app/src` from upstream files). Awaiting review. |
| P1.3 | done | #506 | Config, build hooks and Docker moved to `pacs-ai/`; 3 ledger rows (webpack.base, webpack.pwa, rsbuild hooks). G1/G3/G4 pass; G2 1848 vs 1857 at branch point in the same container (no new errors). Image `pacs-ai-viewer-migration:p13-b3384e6a7` deployed on the MHI server 2026-11-17 14:45: login, version.json and AI Predictions verified. Build: `docker build -f pacs-ai/docker/Dockerfile.pacs-ai --build-arg APP_BUILD_ID=<id>`; CA certs go in `pacs-ai/docker/ca-certificates/` (git-ignored). |
| P2.1 | done | #507 | `platform/ui` identical to upstream; `@pacs-ai/ui` + `@pacs-ai/theme`. G2 1834 → 1749 (0 new); G3 227 suites / 1814 tests. Image p21-39e12c868 deployed 2026-11-17 15:35: login, settings, members, workspace settings match the 2026-11-15 baseline except intended changes (version text, the F21 toggle, AI Predictions no longer "coming soon"; members times shown in the capture's time zone). Two upstream files with import-only edits (ViewerHeader.tsx, WorkList.tsx) are restored in P2.3/P2.5; no ledger rows added on purpose. |
| P2.2 | done | #508 | `@pacs-ai/extension-core`: API client, session, providers, locales, services, `ohifCompat/`; platform/i18n, DicomWebDataSource, initWADOImageLoader, hooks/index.ts back to upstream. Independent review: 3 findings fixed (fr/de side-panel labels, `?token=` override, stale model list), i18n improvements kept (en-US namespaces now resolve). Deployed p22-7d412176b 2026-11-17: acceptance 54 pass / 3 fail (2 pre-existing: action-bar Series label, compare after expiry; 1 data-dependent chat citation) / 8 skip. Tour services stayed in core (decide at P2.3). |
| P2.3 | done | #511 | `@pacs-ai/extension-shell`: pages via `routes.customRoutes` (private-route wrapping works; `DataSourceWrapper` not needed), work list at `/` (`showStudyList` forced false), layout template replacing the default layout entry until P2.6, server-gated tour. routes/index.tsx, App.tsx, App.css, index.js, WorkList, ViewerLayout, ViewerHeader, ui-next Header and ErrorBoundary back to upstream; modified upstream files 580 → 379. Independent review: tour never started (fixed), error boundary coverage, showStudyList guard, order test, location tracking, showAlert. Deployed p23-e95403ed2: acceptance 54 pass / 3 fail (same 3 as P2.2) / 8 skip. P2.6: Onboarding `shouldShowTour`/`onTourShown` props exist only in the fork's Onboarding. |
| P2.5 | done | #512 | `@pacs-ai/extension-chat`: ChatBox/ChatButton moved, chat button as toolbar button (`pacsAiChat` section rendered by the shell header), citation context exported at `@pacs-ai/extension-chat/citations`. Deployed p25-cbf460727: chat, refresh-and-citations, viewer-shell, stored-results specs 11 pass / 1 skip. |
| P2.4 | done | #513 | `@pacs-ai/extension-inference`: inference components, AIModelButton (toolbar button `pacsAi.runModel`), study browser panel (copies of upstream StudyBrowser/StudyItem/ThumbnailList/Thumbnail ~1,700 lines, panel ids swapped at lookup until P2.6), addSegmentation; `SelectSeriesModal` moved to `@pacs-ai/ui`. Six study-browser upstream files restored; modified upstream files 379 → 146, import violations 230 → 22. Inference → chat dependency accepted by the owner. Independent review: no blockers; smoke and registration tests added. Deployed p24-af9c830f0: 57 pass; reference model runs blocked because the reference studies changed after re-retrieval (re-baseline the golden runs before phase 3). |
| P2.6 | done | `wp/P2.6-mode` (draft PR) | `@pacs-ai/mode-viewer` (`modes/pacs-ai`): built from longitudinal's modeFactory, serves `/viewer` (replaces `@ohif/mode-longitudinal` in pluginConfig; first in `pacs-ai.js` `modes`); names the shell layout, the inference tracked study browser, run-model/chat sections and a new "Series:" label in `viewportActionMenu.topMiddle` (F15 bug fixed). Keys, cine player and US/XA autoplay (Cine Rate) in the shell (`viewerBehaviour/`), applied by the mode and, for the stock modes, by the shell's onModeEnter. Layout and study-browser swaps kept, scoped in effect to the stock modes still registered (segmentation offered by the work list; tmtv, microscopy, preclinical-4d, usAnnotation by URL). Tour on upstream Onboarding (server told from the first step's `show`). Restored: hotkeyBindings, both CinePlayer.tsx, AppTypes, ViewportActionBar, Onboarding, DataSourceWrapper; StaticWadoClient ledger row 4. Modified upstream files 146 → 138, ledger 3 → 4, import violations 22 → 24 (2 = new package's root babel/jest config, same pattern as every package). G2 1648 → 1645; G3 253 → 260 suites, 1894 → 1931 tests (inference PacsAiThumbnail suite fails at the branch point too, in the full run only). Remaining unexplained edits are colour/theme (P3.4). Behaviour changes: new "Series: n/N · #number description" label (n/N among the image series of the shown series' study; non-image series show "#number description" only), shown on the active or hovered viewport only (OHIF draws that area only then); the cine bar can now be closed on US/XA (the fork immediately re-opened and restarted it), autoplay restarts when the series changes; `@ohif/mode-longitudinal` no longer registered (mode display name "PACS-AI Viewer"); the cine player's empty outer box no longer catches clicks. Independent review: no blockers; Series count fixed. Deployed p26-9f77b433b: full suite 57 pass / 2 data-dependent fails, `viewer-behaviour.spec.ts:58` (Series label) passes for the first time; viewer specs rerun 14 pass. || P2.7 | done (gates; acceptance suite left to the orchestrator) | `wp/P2.7-close` (draft PR) | Hygiene in our packages (3.5): no `propTypes`/`defaultProps` (TypeScript prop types, parameter defaults), no `react-test-renderer` (56 test files on @testing-library/react, same cases and expectations), no `useRef()` without argument and no `forwardRef` found (none to list); unused deps dropped (`react-markdown`/`remark-gfm`/`prop-types` from ui, `prop-types` from chat/inference/shell, unused @ohif peers). `prop-types` stays in core: its API repositories throw the imported `object` validator as a fallback error value (runtime behaviour, left for a separate fix). Import rules: per-package `.eslintrc.json` (`no-restricted-imports` per the 6.1 table + `import/no-relative-packages`) and `pacs-ai/eslint/upstream-imports.eslintrc.json` for upstream code, run by `pacs-ai/scripts/lint-imports.sh` (ours 647 files / upstream 1368 files, 0 errors). Imports that exist but are not in the 6.1 table are named exceptions in those files, for the owner to accept or retire: ui → theme, ui → extension-core, core → `@ohif/ui-next`, shell → `@ohif/i18n`, shell → extension-inference, and two non-exported `@ohif/extension-default` layout pieces (P3.3). Deep `@pacs-ai/<pkg>/src/...` imports between our packages are allowed by the table and not yet replaced by public entry points (406 imports in 188 files; follow-up). The 10 `@ohif/app/src` imports are gone (icons moved into the shell; the session test makes OHIF's token call itself). Drift guard enforced: `pacs-ai/THEME_DEBT.txt` (66 files, one line each with its P3.4 item), ledger 4 → 7 rows (`.prettierignore`, untracked `platform/app/.env` + `.gitignore`); everything else restored (READMEs, `.netlify`, recipes, rollbar/index templates, service-worker files, fonts.css, Queue.test.js, docs package, jest base config, three dependency manifests with the bumps moved to root `resolutions`) or moved to ours (`pacs-ai/README.md`, `pacs-ai/docs/`, rollout spec with its own config, `pacs-ai/build/{public,env.example}`; env-config and title injected by the build hook). CI: `pacs-ai-drift.yml` runs `--enforce`. Full-run-only `PacsAiThumbnail` failure fixed (virtual `@ohif/ui-next` mocks in two other suites leaked into it). Image p27-1ce02ecf7: `/`, `/viewer?StudyInstanceUIDs=x`, `/segmentation` 200; `env-config.js` before `app-config.js`, title, sw kill switch, version.json served. |

## Phase 2 final numbers (P2.7, `wp/P2.7-close` @ 1ce02ecf7 vs v3.11.1)

| Measure | P1.2 report | P2.6 | P2.7 |
|---|---:|---:|---:|
| Modified upstream files | 1024 | 138 | 81 (66 theme debt + 7 ledger + 8 expected) |
| Ledger rows (limit 15) | 0 | 4 | 7 |
| Theme-debt files | 58 (heuristic) | 50 (heuristic) | 66 (listed in `pacs-ai/THEME_DEBT.txt`) |
| Unexplained files | 952 | 77 | 0 |
| Import-direction violations (drift script) | 57 | 24 | 0 |
| ESLint import-rule errors (ours / upstream) | – | – | 0 / 0 |
| G2 type errors | 1843 (P1.4) | 1645 | 1645 (branch point 185d126cb: 1645) |
| G3 unit tests | 216 / 1712 | 260 / 1931 (1 suite failing in the full run) | 261 suites / 1937 tests, all passing in one `yarn test:unit:ci` run |

Expected files: `yarn.lock`, `bun.lock` (now counted as a lock file), root and app `package.json`, `pluginConfig.json`, and three `.github/workflows` entries (`playwright.yml` disabled, `codespell.yml.disabled`).

## Temporary swaps still in place (after P2.7)

| Swap | Where | Why | Goes when |
|---|---|---|---|
| Default viewer layout entry points at our layout | `extensions/pacs-ai-shell/src/layout/replaceDefaultViewerLayout.ts` (shell `preRegistration`) | Stock modes still registered (`/segmentation`, offered by the work list; tmtv, microscopy, preclinical-4d, usAnnotation by URL) name `@ohif/extension-default`'s layout; `modes/pacs-ai` names ours directly | Stock modes retired or given PACS-AI variants (P3.3 mode work) |
| Default study browser panels point at ours | `extensions/pacs-ai-inference/src/studyBrowser/replaceStudyBrowserPanels.ts` | Same stock modes keep the PACS-AI study browser (badges, eager display sets, refresh) | Same |
| Viewer behaviour and header buttons added in `onModeEnter` | shell (`viewerBehaviour/`: keys, cine/autoplay, Series label), inference (run-model button), chat button | Same stock modes keep F15 and the toolbar entries they had before P2.6 | Same |
| `showStudyList` forced off | `turnOffOhifStudyList` in the shell | `/` must be our work list (custom route), not OHIF's list | P3.3 (`workList.variant` in 3.13) |
| Two `@ohif/extension-default` layout pieces imported by source path | `extensions/pacs-ai-shell/src/layout/upstreamLayoutPieces.ts` | Not exported by the package | Layout rebased on 3.13.14 (P3.3) |
