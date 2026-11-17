# PLAN: move PACS-AI from OHIF 3.11.1 to OHIF 3.13.14 as a modular fork

Audience: an orchestrating agent (Claude Fable 5.2, model ID `claude-fable-5-2`) that delegates work packages to subagents and integrates their results. Read this file completely before starting. `README.md` in this directory holds the analysis this plan is based on.

Written 2026-11-15. Owner and only source of authorization: the repository owner (the user). Analysis by four research agents; nothing has been built or run on OHIF 3.13 or 3.14 yet. Target changed from 3.14 to 3.13.14 by the owner on 2026-11-15: 3.14 is still beta and adds little for PACS-AI.

---

## 1. Mission

1. Bring PACS-AI (the `HeartWise-AI/PACS-AI` viewer, a fork of OHIF 3.11.1) onto OHIF 3.13.14, the latest stable release.
2. Keep every PACS-AI feature working (section 5 lists them; section 8 defines the tests that prove it).
3. Take every upstream fix and feature between 3.11.1 and 3.13.14.
4. Restructure PACS-AI code into packages we own, attached through OHIF's extension points, so that the next upgrade (3.14, once released) is `git merge <tag>` plus a short checklist. Choices in this plan must not make the 3.14 step harder (section 3.5). Target: at most 15 edited OHIF files, each listed in a ledger and enforced by CI.

Done means: section 11 "Definition of done" is satisfied.

## 2. Hard rules

These override anything else in this plan.

| # | Rule |
|---|---|
| R1 | Never push to `main`, merge a pull request, or deploy to any server without the user's explicit go-ahead for that specific action. Open pull requests as drafts against the integration branches named in section 4. |
| R2 | Never deploy to the MHI server (`sgbmavram01.icm.local`). It is also the test environment (section 8): read-only use is allowed, changes are not. Rollout is a separate, user-run step after this plan. To test a new build, run it as a separate container on another port against the same backend; do not replace the running `pacs-ai` container. |
| R3 | No patient data, hospital hostnames, certificates, tokens or credentials in the repository, in commit messages, in PR text or in subagent prompts. Viewer test credentials are read from environment variables only. |
| R4 | Outside the paths listed in section 6.1 ("ours"), a file must be byte-identical to the pinned upstream ref unless it has a row in `pacs-ai/UPSTREAM_PATCHES.md`. If a task seems to need a new upstream edit, first look for an extension point (section 6.3); if none exists, add the ledger row in the same commit and say so in the PR. |
| R5 | Do not delete or weaken a test to make it pass. A test may be changed only when the behaviour it checks was deliberately changed, with the reason in the commit message. |
| R6 | Do not report a work package as done unless its exit checks (section 9) were actually run and passed. Report failures with the output. |
| R7 | One work package per pull request. Keep moves and behaviour changes in separate commits: a move commit must be a pure `git mv` plus import-path fixes. |
| R8 | Before any Docker build check `df -h /`; stop if less than 150 GB is free. Do not run `docker system prune`, `docker volume prune` or remove images you did not build. |
| R9 | If two consecutive attempts at the same work package fail its exit checks, stop that package, write what was tried to `docs/ohif-upgrade/STATUS.md`, and continue with packages that do not depend on it. |
| R10 | Subagents get a brief that follows the template in section 10.2. They do not get this whole file. |

## 3. Facts

### 3.1 Versions and refs

| Name | Ref | Commit | Date |
|---|---|---|---|
| Our code today | `origin/main` | `364555f69` | 2026-11-17 (features F18–F24 added since the baseline; see section 5) |
| Baseline tag (same commit) | `baseline/ohif-3.11.1-pre-3.13-upgrade` | `abe08101a` | |
| OHIF base of the fork | `v3.11.1` | `3c2b027e8bc7a238ffe46ecb5f57c6c913069c3e` | 2025-10-28 |
| **Target pin** (latest stable) | `v3.13.14` | `e4cd86153a1aaa429ef749330eaeefd4df96a88a` | 2026-11-03 |
| Next release, beta only (look-ahead, not a target) | `v3.14.0-beta.91` | `d493d1cb7676d7259761f9669b4f38d3fefe38bd` | 2026-11-13 |

Upstream repository: `https://github.com/OHIF/Viewers.git`. Fetch tags without polluting our tag namespace:

```bash
git fetch --no-tags https://github.com/OHIF/Viewers.git \
  refs/tags/v3.11.1:refs/upstream/v3.11.1 \
  refs/tags/v3.13.14:refs/upstream/v3.13.14 \
  refs/tags/v3.14.0-beta.91:refs/upstream/v3.14.0-beta.91
```

**The target is `v3.13.14`.** The `release/3.13` branch receives security patch releases (3.13.1 to 3.13.14 so far). Before starting phase 3, check for a newer 3.13 patch (`git ls-remote --tags https://github.com/OHIF/Viewers.git 'v3.13.*'`); if one exists, use the newest `v3.13.x` without `-beta` and record it in `STATUS.md`. Do not target 3.14 in this plan: it exists only as betas, with no release branch. It is handled as the first run of the phase 4 procedure after its stable release.

The fork has **no shared git history** with OHIF (it was imported as files). Work package P1.4 fixes that.

### 3.2 Size of the problem

Fork against 3.11.1: 629 files added, 299 OHIF files modified, 7 OHIF files deleted.

Upstream 3.11.1 → 3.13.14: 1824 files changed (939 added, 463 deleted, 785 modified), 733 commits (28 features, 197 fixes).

Simulated three-way merge (base 3.11.1, ours main, theirs 3.13.14): 107 conflicted paths — 76 textual (152 hunks), 9 add/add (all translation files), 19 where we modified and upstream deleted, 3 where we deleted and upstream modified. By area: platform/ui-next 32 files, platform/i18n 22, platform/app 12, extensions/default 6, root files 9. Per-file hunk counts: see `README.md`.

What our 299 modifications are:

| Kind | Files | Treatment |
|---|---|---|
| Colour and style swaps | 99 | Replace with a theme package (P3.4) |
| Formatting only | 59 | Revert to upstream (P1.1) |
| Docs and translations | 60 | Revert docs; move translations to our package (P2.2) |
| Build, config, tooling | 53 | Our own config, Dockerfile and build plugin (P1.3, P3.1) |
| Behaviour changes | 16 | Extension point or ledger patch (section 7) |
| Hook-ins | 12 | Extension points (P2.3 to P2.5) |

### 3.3 What changes upstream (3.11.1 → 3.13.14)

Breaking for us:

| Area | Change |
|---|---|
| Package manager | yarn 1 + lerna + nx → pnpm 12.8.1 workspaces (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.npmrc`, `workspace:*`, `nodeLinker: hoisted`). `yarn.lock`, `bun.lock`, `lerna.json`, `nx.json`, `addOns/` are gone. Resolutions move to `overrides` in `pnpm-workspace.yaml`; postinstall scripts must be allow-listed under `allowBuilds`. |
| Node | ≥ 24 (`.node-version` 24.22.2) |
| Bundler | webpack 5 → rspack 2. File names `.webpack/webpack.*.js` are kept but now `require('@rspack/core')`. Production build: `rspack build --config .webpack/webpack.pwa.js` (asks for a 24 GB heap). `dev:fast` uses rsbuild 1.7.3. `dotenv-webpack` and `workbox-webpack-plugin` are dropped. |
| React | Stays 18.3.1. TypeScript 5.5.4, jest 29.7, Playwright 1.56.1 unchanged. |
| Cornerstone3D | 4.5.13 → 5.6.8 (major), new `@cornerstonejs/metadata`; vtk.js 32 → 36; dcmjs 0.43 → 0.52 |
| Customization | Phased config (`requires`/`bootstrap`/`global`/`mode`); `customizationService.init()` moved into `appInit.js`; `?customization=` URL loader (off unless `customizationUrlPrefixes` is set) |
| App init | Order is now: mode customizations, bootstrap customizations, `registerExtensions`, `customizationService.init`, global customizations, mode commands, `modeFactory`. `App.tsx` inserts `serviceProvidersManager` providers ahead of `DialogProvider`. |
| Work list | New ui-next study list at `/`. Old one moved to `routes/LegacyWorkList/LegacyWorkList.tsx` behind `workList.variant: 'legacy'`. `routes/WorkList/filtersMeta.js` and `index.js` moved with it. `DataSourceWrapper` issues one query with `queryLimit` (default 101) and pages client-side. |
| Old `@ohif/ui` | Legacy; storybook removed; its only importer outside itself is `LegacyWorkList` |
| Onboarding | `react-shepherd` removed; `shepherd.js` 15 used directly |
| Modes | New `modes/basic` (`@ohif/mode-basic`); longitudinal, segmentation, tmtv inherit from it; their own `toolbarButtons.ts` deleted. `initToolGroups` takes one options object. `enableSegmentationEdit` replaced by `modeCustomizations`. |
| Toolbar | `segmentationToolbox` split into `labelMapSegmentationToolbox`, `contourSegmentationToolbox`, `labelMapSegmentationUtilities`, `contourSegmentationUtilities` |
| Services | `removeSegmentationRepresentations` → `removeRepresentationsFromViewport`; `esc` bound to `cancelActiveOperation` |
| DICOM video | `@ohif/extension-dicom-video.viewportModule.dicom-video` removed; video goes through the cornerstone viewport |
| Dates | `formatDICOMDate(date, { strFormat })`; `metadataProvider` no longer formats patient name and dates |
| Colours | Legacy tailwind colours map to ui-next tokens (`primary-light` → `highlight`, `primary-dark` → `muted`, `secondary-dark` → `popover`, `primary-active` → `primary`); `bg-black` → `bg-background` |
| Default config | `config/default.js` locked down: one data source, no multimonitor, dynamic config off; `maxNumRequests.thumbnail` lowered |
| Other library moves | i18next 17 → 19 (at 3.13.14); date-fns 3 → 4; react-day-picker 8 → 9; `@tanstack/react-table` 8.21 added |
| Security | Dynamic config URL hardening (`utils/secureConfigFetch.js`); `/logout?redirect_uri` same-origin only; report-only CSP; nginx recipes drop wildcard CORS |

Useful to us:

- Theme system: `platform/ui-next/src/themes/*` (six presets plus `themes.css`), `ActiveThemeProvider`, the opt-in `@ohif/extension-default.customizationModule.theme`, `ohif.appearanceModal`. Docs: `platform/docs/docs/platform/services/customization-service/appearance-theming.md`.
- Customization keys: `routes.customRoutes`, `ohif.menuContent`, `ohif.aboutModal`, `ohif.tours`, `ohif.hotkeyBindings`, `studyBrowser.thumbnailMenuItems`, `studyBrowser.thumbnailDoubleClickCallback`, `workList.*`.
- `serviceProvidersManager.registerProvider` for app-wide React providers.
- `userAuthenticationService.setServiceImplementation` for auth headers.
- Mode `leftPanels`/`rightPanels` and toolbars as mode-scope customizations (`$set`, `$push`).
- `ExtensionManager.registerCommandsModule()`; modes may export `getCommandsModule` and a `customizations` map.
- Upstream migration guides in the target ref: `platform/docs/docs/migration-guide/3p11-to-3p12/index.md` and `3p12-to-3p13/` (15 pages). **Every subagent working on phase 3 must read the pages relevant to its package.** The guides say pnpm 11 and "no preinstall"; the tree has pnpm 12.8.1 and still runs `preinstall.js` — trust the tree.

### 3.5 What 3.14 will change later (do not implement now; do not make it harder)

From `v3.14.0-beta.91`: React 19.2.7 with the React Compiler on every `src/` under `platform/`, `extensions/*`, `modes/*`; production build on rsbuild 2; ESLint 10 flat config; Cornerstone3D 5.18; display sets in the Cornerstone metadata cache (`getDisplaySetCache()` returns a copy); `useViewportRef` removed; `useCustomization` hook required for render-time reads; `LegacyWorkList` and `@ohif/ui` deprecated; DICOMweb QIDO and WADO clients merged; new keys `ohif.headerRightSide` and `studyBrowser.thumbnailDetails`; `bulkDataURI.transform` applied to absolute URIs. 108 of the 299 OHIF files the fork edits today change again.

Rules that follow, cheap now and expensive later:

- Our code never imports `@ohif/ui`, `LegacyWorkList`, or `react-test-renderer`.
- No `propTypes`, no `defaultProps` on function components, every `useRef` has an argument.
- Render-time customization reads, display-set access and viewport element access go through `ohifCompat` (6.4).
- No writes to `getDisplaySetCache()`.
- No edits to ui-next component files; wrap or customize instead.

### 3.4 Problems inside the fork

| Problem | Detail |
|---|---|
| No extension points used | No PACS-AI extension or mode exists. Providers are added in `platform/app/src/App.tsx`, routes in `platform/app/src/routes/index.tsx`, viewer UI in `extensions/default/src/ViewerLayout/index.tsx` and `ViewerHeader.tsx`, auth by reading `localStorage.sessionToken` inside the data source and image loader. |
| Inverted imports | 14 files under `platform/ui`, `platform/ui-next`, `extensions/default`, `platform/core` import `@ohif/app/src/...` or another package by relative path. Example: `platform/ui-next/src/components/StudyBrowser/StudyBrowser.tsx` imports `@ohif/app/src/GlobalStateProvider` and `extensions/default/src/ViewerLayout/index.tsx`. |
| Our code inside old `@ohif/ui` | 50 components plus 21 assets under `platform/ui/src/components/` (ChatBox 30 files, ChatButton, AIModelButton, AdminTable, Sidebar, SidebarAdmin, Logo, ButtonGradient, ButtonSecondary, StoreFileButton). 26 of our app files import `Typography` (20), `Button` (18), `Logo`, `StoreFileButton`, `ButtonGradient` from `@ohif/ui`. Our pages also rely on restyles of old-ui `Button`, `ButtonGroup`, `Input`, `InputFilterText`, `InputMultiSelect`, `Select.css`, `Tooltip`, `StudyListExpandedRow`. |
| Duplicate component | `AIModelButton` exists in both `platform/ui` and `platform/ui-next`; the ui-next one has no importer. |
| Stale files | `modes/{longitudinal,tmtv,basic-dev-mode}/src/index.js` next to upstream's `index.ts`. |
| Stock features lost | `showWarningMessageForCrossOrigin`, `groupEnabledModesFirst`, `experimentalStudyBrowserSort` have no references; `InvestigationalUseDialog` is not rendered. See decision D3. |
| Hardcoded version | `App.tsx` has `frontendVersion = 'v0.58.0-beta'`. |

## 4. Branches and workspace

| Branch | Purpose | Base |
|---|---|---|
| `main` | Production line. Do not push. | |
| `integration/modular-3.11` | Phases 1 and 2: modular fork still on OHIF 3.11.1. Deployable. | P1.4 result |
| `integration/ohif-3.13` | Phase 3: the upgrade. | `integration/modular-3.11` after phase 2 |
| `wp/<id>-<slug>` | One per work package, PR into its integration branch. | the integration branch |

Create the two integration branches yourself (pushing new non-main branches is allowed). Merging work-package PRs **into the integration branches** is allowed once the package's exit checks pass; merging an integration branch into `main` is not (R1).

Use one git worktree per active work package under `/home/ravram/pacs-ai-wp/<id>` (create with `git worktree add`). Never use `git stash`. Commit identity: reuse the author of commit `d24465d` with `git -c user.name=... -c user.email=...`; do not print the e-mail.

Builds and tests run in Docker so the host needs no Node:

- Phases 0 to 2 (OHIF 3.11.1): `node:20.18.1-slim`, yarn 1.22.22.
- Phase 3 (OHIF 3.13.14): `node:24.22.2-slim`, `npm i -g pnpm@12.8.1`.
- Playwright: `mcr.microsoft.com/playwright:v1.56.1-noble` (already on the host).

Keep a running log in `docs/ohif-upgrade/STATUS.md` on the integration branch: one line per work package with state (todo, running, done, blocked), PR number, and for blocked items what was tried.

## 5. Features that must survive

Paths are relative to `platform/app/src/` unless they start with a top-level directory.

| # | Feature | Where it lives today | Upstream files it edits today |
|---|---|---|---|
| F1 | API client: axios with bearer session token, 401/suspended/policy interceptors, repositories, DTOs | `pacsAPIAxios.js`, `api/*` (22 files) | none |
| F2 | Login, register, reset and change password, policy acceptance, consent, tenant-not-found, Turnstile, Firebase | `routes/{Login,Register,ResetPassword,ChangePassword,PolicyAcceptance,User/Consent,TenantNotFound,Settings}`, `service/*Session.ts`, `service/userService.ts`, `utils/authenticatedSession.ts`, `components/auth/TurnstileWidget.tsx`, `firebase.js` | `routes/index.tsx`, `extensions/default/src/DicomWebDataSource/index.ts`, `extensions/cornerstone/src/initWADOImageLoader.js`, `.../utils/StaticWadoClient.ts`, `.webpack/webpack.base.js` |
| F3 | Members admin, Kibana logs | `routes/Members` (19), `routes/KibanaLogs`, `platform/ui/.../{AdminTable,SidebarAdmin,Sidebar}` | `routes/index.tsx`, `platform/ui/src/index.js` |
| F4 | Workspace settings: DICOM modalities, ingestion jobs, tenant onboarding, model catalog with versions, deployment progress over SSE, GPU inventory and placement | `routes/WorkspaceSettings` (55), `routes/AIModels`, `components/ModelFactsModal.tsx`, `modelQuestionnaireValidation.ts` | `routes/index.tsx` |
| F5 | Run a model from the viewer: model picker, series and exam selection, output modals (JSON, HTML, PDF, web app), labelmap import | `platform/ui/.../AIModelButton`, `components/inference/*` (19 at root), `extensions/cornerstone/src/utils/addSegmentation.ts`, `GlobalStateProvider.tsx` | `ViewerHeader.tsx`, `ViewerLayout/index.tsx`, ui-next `StudyBrowser.tsx`, `StudyItem.tsx`, `PanelStudyBrowser.tsx`, `createStudyBrowserTabs.ts` |
| F6 | Stored results in the viewer: previous-results drawer, ready notice, selected-view badges on thumbnails | `components/inference/viewerResults` (13) | `ViewerLayout/index.tsx`, `PanelStudyBrowser.tsx`, ui-next `Thumbnail.tsx` |
| F7 | Study processing: per-study status (REST and SSE), run history, reprocess, notifications bell, result renderers | `components/inference/studyProcessing` (165, `modelResults/` 72), `hooks/useCandidateProcessingPoll.ts`, `InferenceProcessingProvider.tsx` | `App.tsx`, `hooks/index.ts`, `WorkList.tsx`, `webpack.base.js` |
| F8 | Chat assistant: draggable chat, tool-activity steps, series carousel | `platform/ui/src/components/ChatBox` (30), `ChatButton` | `ViewerHeader.tsx`, `platform/ui/package.json` |
| F9 | Viewer tour: server-side once-per-user flag, tutorial progress overlay, settings toggle | `service/{viewerTourService,tutorialService}.ts`, `components/TutorialProgressOverlay.tsx`, `routes/Settings/ViewerTourPreference.tsx` | ui-next `Onboarding/Onboarding.tsx`, `ViewerLayout/index.tsx`, `App.tsx` |
| F10 | Work list: Orthanc repository, react-query, date pickers, search-session restore, DICOM upload, processing status column | `routes/WorkList/{WorklistTopNavigation,expandedStudyRows,worklistSearchRestore}`, `utils/worklistSearchSession.ts`, `components/{Table,Modal}.tsx`, `platform/ui/.../StoreFileButton` | `routes/WorkList/WorkList.tsx` (+1166/−615), `index.js`, `App.css` |
| F11 | Top navigation shared by all pages | `components/TopNavigation` (7), `AlertProvider.tsx` | `ViewerLayout/index.tsx`, ui-next `Header/Header.tsx` |
| F12 | Branding: lime `#c8f469` on dark `#151815`, logos, favicons, fonts | assets under app (53), ui (21), ui-next (21); `platform/ui/.../{Logo,ButtonGradient,ButtonSecondary}` | about 99 files |
| F13 | Translations: namespaces AIModelButton, ChatBox, TopNavigation, Settings, Members, Sidebar, Onboarding, HeaderPanel, StoreFileButton, TutorialProgressOverlay, ResultModal | 69 JSON files (fr, de, es, en-US, ar, zh) | 47 locale files |
| F14 | Build version and release: `version.json` at build, in-app update monitor, runtime `env-config.js`, no-store headers, service-worker kill switch | `.webpack/frontendBuildVersion.js`, `platform/app/scripts/generate-env-config.js`, `components/FrontendUpdateMonitor.tsx`, `utils/frontendVersionMonitor.ts`, `platform/app/public/sw.js`, `docker-compose.yml`, `platform/app/public/config/local_pacs_ai.js` | `webpack.base.js`, `webpack.pwa.js`, `rsbuild.config.ts`, `Dockerfile`, nginx templates, `index.html`, `init-service-worker.js`, `App.tsx` |
| F15 | Viewer behaviour tweaks: cine autoplay for US and XA with `CineRate`; arrow keys change series and page keys change image; current series shown in the viewport action bar; error boundary without notification; data source error modal off | — | the class-c files in section 7 |
| F16 | CI: self-hosted unit tests, staging validation, PR assistant | `.github/workflows/{claude,self-hosted-unit-tests,self-hosted-unit-tests-pr,staging-release-validation}.yml`, `CODEOWNERS` | `playwright.config.ts`, `jest.config.base.js` |
| F18 | Running-jobs card (bottom right) with cancel, honest waiting wording and per-model counts; bell opens the exam (PACS-AI #495–#497) | `components/inference/runningJobs/` | none |
| F19 | Refresh study from PACS: retrieve, progress, reload series in place, "still growing" dot (#498) | `components/inference/studyRefresh/` | `extensions/default/src/Panels/StudyBrowser/PanelStudyBrowserHeader.tsx` (4 lines), `PanelStudyBrowser.tsx` (8 lines); relies on the data source cache key `"<data source>:<uid>"` |
| F20 | Chat citation chips `[n]` opening model result or web source (#498) | `platform/ui/src/components/ChatBox/{utils/citations.ts,components/CitationChip.tsx,citations/}`, `components/inference/viewerResults/chatCitations.ts` | none (context crosses the portal from `ViewerModelResultsProvider`) |
| F21 | Notification audience: gateway `notify` flag, regular users only see final outcomes of their own runs, toast grouping, "Automatic" tag, Settings toggle "Notify me about automatic analyses", patient/modality lookup for off-page studies (#499, #500) | `components/inference/{notificationAudience.ts,inferenceNotifications.ts,InferenceProcessingProvider.tsx}`, `routes/Settings/` | none |
| F22 | Readable table for flat model results without a template (PanEcho 1.0.3), raw data kept (#499) | `components/inference/studyProcessing/{readableResult.ts,ReadableModelResult.tsx}` | none |
| F23 | AI Predictions page: one row per exam, My/Automatic/All runs (admins), filters, retrieve-from-PACS-and-open, key results, history and compare, CSV export; never-ran/expired states (#502) | `routes/AiPredictions/` | `routes/index.tsx` (route), `components/TopNavigation/navigationModel.ts` (nav item) |
| F24 | Login cooldown notice when the Turnstile challenge cannot be used (countdown, forgot-password link) (#501); admin ingestion jobs show creator and a per-job notification switch (#500) | `routes/Login/`, `routes/WorkspaceSettings/ingestion-jobs/` | none |
| F17 | 151 test files (more since: the F18–F24 work added roughly 30 suites; recount at P0) | app 142, ui 7, extensions/default 1, `tests/StudyProcessingRollout.spec.ts` | `Queue.test.js` |

## 6. Target architecture

### 6.1 Layout

```
extensions/
  pacs-ai-core/        @pacs-ai/extension-core
  pacs-ai-ui/          @pacs-ai/ui
  pacs-ai-theme/       @pacs-ai/theme
  pacs-ai-shell/       @pacs-ai/extension-shell
  pacs-ai-inference/   @pacs-ai/extension-inference
  pacs-ai-chat/        @pacs-ai/extension-chat
modes/
  pacs-ai/             @pacs-ai/mode-viewer
pacs-ai/
  build/               build-version plugin, env-config generator
  docker/              Dockerfile.pacs-ai, nginx templates, compose file
  config/              pacs-ai.js (app config, chosen with APP_CONFIG)
  scripts/             check-upstream-drift.sh, upgrade-ohif.sh, apply-patches.sh
  patches/             one .patch file per ledger row
  UPSTREAM_PATCHES.md  the ledger
  UPSTREAM_REF         one line: the pinned upstream tag
tests/pacs-ai/         Playwright acceptance suite
docs/ohif-upgrade/     this plan, README.md, STATUS.md
.github/workflows/pacs-ai-*.yml   our workflows (rename ours with this prefix)
```

"Ours" = exactly the paths above, plus `.github/CODEOWNERS`. Everything else is upstream-owned.

| Package | Contents | May import |
|---|---|---|
| `pacs-ai-ui` | Our primitives moved from `platform/ui` (Logo, ButtonGradient, ButtonSecondary, AdminTable, Sidebar, SidebarAdmin, StoreFileButton), a `Typography` and `Button` matching what our pages use, assets | `@ohif/ui-next`, react |
| `pacs-ai-theme` | Theme tokens, fonts, favicon and logo assets, the white-label config fragment | `@ohif/ui-next` |
| `pacs-ai-core` | F1 API layer; session and auth; OHIF services `pacsAiSessionService`, `pacsAiModelsService`, `pacsAiStudyContextService` (replaces `GlobalStateProvider` and `AvailableModelsContext`); app providers (react-query, alerts, study processing, inference processing) registered with `serviceProvidersManager`; translations registered with `i18n.addLocales`; `useSafeCustomization` hook; `ohifCompat/` adapter (see 6.4); update monitor | `@ohif/core`, `@ohif/i18n`, `pacs-ai-ui` |
| `pacs-ai-shell` | F2 to F4 pages as `routes.customRoutes`; F10 work list page; F11 top navigation; viewer layout template (`getLayoutTemplateModule`) built from our current `ViewerLayout` and `ViewerHeader`; F9 tour gating | core, ui, theme, `@ohif/core`, `@ohif/ui-next`, `@ohif/extension-default` public API |
| `pacs-ai-inference` | F5 to F7: `components/inference/**` (197 files), AIModelButton, `addSegmentation`, study browser panel module wrapping upstream's, result renderers | core, ui, `@ohif/core`, `@ohif/ui-next`, `@ohif/extension-cornerstone` public API |
| `pacs-ai-chat` | F8 | core, ui |
| `modes/pacs-ai` | Mode extending `@ohif/mode-basic` in phase 3 (in phase 2, on 3.11.1: built from longitudinal's definition): our layout template, panels, toolbar additions, hotkeys, cine autoplay | all of the above |

### 6.2 Rules enforced by tooling

1. **Import direction.** Nothing upstream-owned imports from an "ours" path or from `@ohif/app/src`. "Ours" never imports `@ohif/app/src/...`, `@ohif/ui` (after P2.1), or another package by relative path. Enforce with ESLint `no-restricted-imports` in our packages and a grep check in `check-upstream-drift.sh`.
2. **Drift guard.** `pacs-ai/scripts/check-upstream-drift.sh`:
   - reads `pacs-ai/UPSTREAM_REF`;
   - lists files that differ between that ref and `HEAD` outside "ours" (`git diff --name-only <ref> HEAD -- . ':(exclude)extensions/pacs-ai-*' ...`);
   - allows the files named in `UPSTREAM_PATCHES.md`, plus generated or expected ones (`pnpm-lock.yaml`/`yarn.lock`, root and app `package.json`, `platform/app/pluginConfig.json`, `pnpm-workspace.yaml`, `.github/workflows/*`, `version.json`, `version.txt`, `commit.txt`);
   - fails on anything else, and fails if the ledger has more than 15 rows;
   - `--report` mode prints counts without failing (used until P2.7).
3. **Ledger.** `UPSTREAM_PATCHES.md` is a table: file, feature (F-number), why no extension point works, patch file under `pacs-ai/patches/`, upstreamable yes/no. `apply-patches.sh` re-applies them with `git apply --3way` after an upstream merge.
4. **Package manifests declare every dependency they import** (pnpm will not resolve undeclared ones).

### 6.3 Extension point for each hook-in

| Today | Replace with | Exists in 3.11.1 |
|---|---|---|
| 12 routes added in `routes/index.tsx` | `routes.customRoutes` customization from `pacs-ai-shell` (`extensions/default/src/customizations/customRoutesCustomization.ts`) | yes |
| Providers in `App.tsx` | `serviceProvidersManager.registerProvider` in `pacs-ai-core` `preRegistration`. Check ordering: providers land ahead of the dialog/modal providers. If a provider needs the router, mount it inside our route elements and layout template instead. | yes (verify in P2.3) |
| Bearer token in `DicomWebDataSource/index.ts` and `initWADOImageLoader.js` | `userAuthenticationService.setServiceImplementation({ getAuthorizationHeader })` in `pacs-ai-core` `preRegistration` | yes |
| `StaticWadoClient.ts` bulk data URI rewrite | Ledger patch. (3.14 applies the data source `bulkDataURI.transform` config to absolute URIs, which should retire it then.) | no |
| `ViewerLayout/index.tsx`, `ViewerHeader.tsx`, ui-next `Header.tsx` | Our own layout template in `pacs-ai-shell`; the mode's `layoutTemplate` points to it. Restore the three upstream files. | yes |
| `PanelStudyBrowser.tsx`, `StudyBrowser.tsx`, `StudyItem.tsx`, `Thumbnail.tsx` | Our panel module in `pacs-ai-inference` that composes upstream's exported study browser pieces. Display-set and modality data flow through `pacsAiStudyContextService` fed by `displaySetService` events. Badges: render through the `children` prop 3.13 adds to `Thumbnail` (verify); on 3.11.1 keep a ledger patch for `Thumbnail.tsx`. (3.14 adds `studyBrowser.thumbnailDetails`.) | panel module yes |
| `Onboarding.tsx` tour gating | `ohif.tours` customization produced by `pacs-ai-shell` after asking the server; ledger patch only if the start-once guard cannot be done from outside | key exists |
| `hotkeyBindings.ts` swap | `ohif.hotkeyBindings` customization / mode `hotkeys` | yes |
| `CinePlayer.tsx` autoplay | `autoPlayCine` app config, plus the `cornerstoneViewportService`/cine service from our mode's `onModeEnter` for US and XA; position via theme CSS | partly |
| `WorkList.tsx` | Our own page in `pacs-ai-shell`, mounted at `/` with `routes.customRoutes`. It must not import from `routes/WorkList`, `routes/LegacyWorkList` or `@ohif/ui`. | yes |
| `default.js` and 22 other config files | `pacs-ai/config/pacs-ai.js`, selected with `APP_CONFIG` | yes |
| Translations in 47 OHIF locale files | Our namespaces in `pacs-ai-core/src/locales`, registered with `i18n.addLocales`. Changed OHIF keys (`Common`, `StudyList`) become overrides in our namespace, or added the same way. | yes |
| 99 colour swaps | On 3.13.14: a theme in `pacs-ai-theme` registered with the theme customization. On 3.11.1 the theme system does not exist: keep the edits as they are through phase 2 (counted separately by the drift guard as "theme debt"), remove them in P3.4. | 3.13+ only |
| `webpack.base.js`, `webpack.pwa.js`, `rsbuild.config.ts`, `Dockerfile`, nginx templates | `pacs-ai/build/` plugin and `pacs-ai/docker/Dockerfile.pacs-ai`. The build config needs a small hook: one ledger patch that loads `pacs-ai/build/extend.(c)js` if present. | n/a |
| `index.html`, `init-service-worker.js`, `sw.js` | Ledger patch for `index.html` only if app config/white-labeling cannot do it; service-worker kill switch shipped from `pacs-ai/build` as a copied public asset | n/a |

### 6.4 The compatibility adapter

`pacs-ai-core/src/ohifCompat/` is the only place our code touches OHIF APIs that this plan knows will change:

- `useSafeCustomization(key)` — wraps `customizationService.getCustomization`; switches to upstream's `useCustomization` at the 3.14 step.
- `displaySets.ts` — read access to display sets; no writes to `getDisplaySetCache()`.
- `viewportElement.ts` — wraps `useViewportRef`; becomes `useViewportElement` at the 3.14 step.
- `dates.ts` — wraps `formatDICOMDate` and patient-name formatting.
- `dicomweb.ts` — anything we need from the data source client.

Rule: our packages import these, never the underlying OHIF API directly. A yearly upgrade then edits this directory first.

## 7. The 16 behaviour changes and their fate

| File | Our change | Fate |
|---|---|---|
| `platform/app/src/routes/WorkList/WorkList.tsx` | Our study list | Becomes `pacs-ai-shell/src/worklist/`; upstream file restored |
| `platform/app/src/routes/DataSourceWrapper.tsx` | Error modal disabled | Our work list route does its own data loading, so first test whether the edit is still needed; else ledger |
| `platform/app/public/init-service-worker.js` | Unregister and purge | Our public asset replaces it at build; or ledger |
| `extensions/default/src/ViewerLayout/index.tsx` | Shell, contexts, tour | Our layout template; upstream restored |
| `extensions/default/src/Panels/StudyBrowser/PanelStudyBrowser.tsx` | Eager display sets, badges, legend | Our panel module; upstream restored |
| `extensions/default/src/DicomWebDataSource/index.ts` | Bearer token | `userAuthenticationService`; upstream restored |
| `extensions/default/src/DicomWebDataSource/utils/StaticWadoClient.ts` | Proxy URI rewrite | Ledger (retire at the 3.14 step with `bulkDataURI.transform`) |
| `extensions/cornerstone/src/initWADOImageLoader.js` | Bearer token | `userAuthenticationService`; upstream restored |
| `extensions/cornerstone/src/components/CinePlayer/CinePlayer.tsx` | Autoplay US/XA, CineRate, position | Config plus mode `onModeEnter`; ledger only for what remains |
| `platform/core/src/defaults/hotkeyBindings.ts` | Key swap | Customization; upstream restored |
| `platform/core/src/utils/createStudyBrowserTabs.ts` | SeriesInstanceUID on tabs | Done inside our panel module; upstream restored |
| `platform/core/src/types/AppTypes.ts` | Removed keys | Restore upstream; declare our config types by declaration merging in `pacs-ai-core` |
| `platform/ui-next/src/components/Onboarding/Onboarding.tsx` | Tour gating | `ohif.tours`; else ledger (upstreamable) |
| `platform/ui-next/src/components/Errorboundary/ErrorBoundary.tsx` | `showNotification` prop | Our routes use our own error boundary; upstream restored |
| `platform/ui-next/src/components/Header/Header.tsx` | Blocks removed | Our layout template does not use it; upstream restored |
| `platform/ui-next/src/components/Viewport/ViewportActionBar.tsx` | Current series | Try viewport overlay/action-menu customization; else ledger (upstreamable) |

## 8. Acceptance suite (the proof that features survive)

Location: `tests/pacs-ai/`. Playwright, run against a deployed build with a real backend.

Configuration by environment only: `PACS_AI_E2E_BASE_URL`, `PACS_AI_E2E_USER`, `PACS_AI_E2E_PASSWORD`, `PACS_AI_E2E_TENANT`, `PACS_AI_E2E_STUDY_UIDS` (comma-separated). Never commit values (R3).

**Test environment (set by the owner, 2026-11-15):**

- Base URL: the MHI server, `https://sgbmavram01.icm.local` (self-signed certificate: `ignoreHTTPSErrors`). This is the live server. Tests may read, open studies, open stored results and use the chat. The owner authorised model runs from the viewer on the reference studies (2026-11-15): `run-model.spec.ts` runs every model on each of them and compares the output with the reference (see "AI reference outputs" below). Tests must still not use the work list's "Reprocess study", change members, settings or the model catalog, or upload files.
- Credentials: `~/.config/pacs-ai/viewer.env` on that host (mode 600, keys `EMAIL` and `PASSWORD`). Load as environment variables for the browser process only; never print, copy or commit them.
- Studies: the three coronary angiography (XA) studies of 2026-11-14 (accessions ending 958701, 958801, 958901; each has stored results for DeepCORO-JEPA 2.1.0, CathEF-CLIP, DeepRV-CLIP, MACE, CTO, SYNTAX) and one echo (US) study. Their UIDs are in `/home/ravram/pacs-ai-baseline/2026-11-15-ohif-3.11.1/studies.env` on the host, not in the repository.
- CT: the server's Orthanc holds no CT (XA 21 studies, US 191 on 2026-11-15). CT studies are visible only through the hospital PACS query in the work list, and the TotalSegmentator model is not installed. The CT/TotalSegmentator check is blocked until the owner names a CT to retrieve and the model is deployed; record it as blocked, do not retrieve one on your own.
- **Image retention (stated by the owner, 2026-11-16):** a server process deletes study images from the local Orthanc about 24 h after they arrive; only AI results are kept. The reference studies above may no longer be stored locally: before a viewer run, retrieve the study from the PACS (the F19 refresh button or the work list retrieve) and confirm it is local; a viewer run on a removed study returns 409 `STUDY_NOT_AVAILABLE_LOCALLY`. The US reference study was already removed on 2026-11-16.
- PanEcho 1.0.3 and the procedure view classifier 1.0.5 now run from the official published images (2026-11-16); the PanEcho and classifier notes below are historical.
- The work list opens on today's date and is empty on days without studies; tests must set the date range (2026-11-13 to 2026-11-15 shows the reference studies).

**Baseline (taken 2026-11-15 on build `chat-activity-d24465d-20261114`, OHIF 3.11.1, identical to main):** 43 screenshots at 1600×900 in `/home/ravram/pacs-ai-baseline/2026-11-15-ohif-3.11.1/` on the host (mode 700; they contain patient data and must never enter the repository or a PR). The capture scripts are in its `scripts/` folder; `visual.spec.ts` should reproduce the same screens: login, register, reset password, work list (empty default, searched, expanded row, French), user menu, settings (English and French), AI models, members, workspace settings (four tabs), Kibana logs, unknown URL, XA viewer for each study, AI menu, result drawer (DeepRV-CLIP, DeepCORO-JEPA, CathEF, SYNTAX), chat, layout menu, US viewer and its AI menu. Visual comparison runs on the host against that folder; only masked or synthetic images may be committed.

**AI reference outputs (owner's requirement: AI results must replicate 1:1).** On 2026-11-16 every model was run from the viewer on the three XA studies: Rerun (or Apply) → "Select first N series" with N = min(model maximum, available) → Apply. All 24 runs completed (8 models × 3 studies: DeepRV-CLIP 1.0.1, CathEF-CLIP 1.0.1, DeepCoro_CLIP_generic 1.0.1, DeepCORO-MACE 1.0.1, DeepCORO-CTO 2.0.1, DeepCORO-SYNTAX 6.0.0, DeepCORO-SCAD 1.0.0, DeepCORO-JEPA 2.1.0). On the host, under the baseline folder:

- `golden/<study>__<model>.txt` and `.png`: the rendered result of each run (report frame text, or the result-data panel for the generic model), plus `golden/<study>__latest-results.json` (the API payload) and `golden/index.json` (run time and "N of M series" per run).
- `ai-runs/<study>__<model>.net.json`: the request each run sent (`seriesInstanceUIDs`) and the run-status responses; `ai-runs/*__1-selection.png` and `__2-result.png`.

`run-model.spec.ts` must, for each study and model: perform the same clicks, assert that the request carries the same `seriesInstanceUIDs` in the same order, wait for the run to finish, and assert that the rendered result text equals the reference after removing the run timestamp. A model's numbers do not depend on the viewer, so any difference means the viewer sent different input or renders the result differently; both are migration defects. Before relying on exact equality, run the suite twice on the current build to confirm the outputs are identical run to run; if a model shows numeric jitter, record the tolerance for that model in `STATUS.md` instead of loosening the comparison globally.

Known behaviour of the environment that the spec must handle (not viewer defects):

- The model gateway keeps a model resident for 10 minutes and the RTX 3090 fits about three at a time; a fourth distinct model can wait up to about 8 minutes and occasionally fails once before a retry succeeds. Allow 12 minutes per run, run models sequentially, and pause about 11 minutes after every three 3090 models. If runs stay in "Processing" with nothing loaded on the GPU, stop and tell the owner (stale GPU reservations; cleared on 2026-11-16 by restarting `api-pacs`).
- `DeepCoro_CLIP_ProcedureViewClassifier` is offered by the viewer ("Apply …") but every run fails with "Model … is not configured" in study-service. Assert that the menu entry exists; do not expect a result.
- PanEcho 1.0.1 is registered for US studies and offered in the viewer, but runs are refused until study-service pins 1.0.1 (cardio-agent PR #508, not yet deployed). Until then assert the menu entry and the series dialog only.

| Spec | Checks |
|---|---|
| `auth.spec.ts` | login, wrong password, tenant lookup failure does not reload, logout, 401 redirects to login, policy acceptance gate |
| `worklist.spec.ts` | list loads, search by name/ID/date, search restored after opening a study and returning, expanded row, processing status column, upload button present |
| `viewer-shell.spec.ts` | top navigation, study browser thumbnails, document title, no upstream header chrome |
| `viewer-behaviour.spec.ts` | XA autoplays cine; arrow keys change series, page keys change image; current series shown in action bar |
| `run-model.spec.ts` | model picker lists models; series selection modal with first-N and maximum; each model runs on each reference study; request and rendered result equal the reference 1:1 |
| `stored-results.spec.ts` | previous-results drawer lists runs; opening a result shows the report; selected-view badges on thumbnails; which series a result used |
| `study-processing.spec.ts` | status updates; run history; notifications bell; reprocess is offered to operators |
| `chat.spec.ts` | chat opens, answer streams, tool-activity steps shown live and on the answer, drag |
| `tour.spec.ts` | tour shows once per user, not again after reload or on another browser context; settings toggle re-enables |
| `admin.spec.ts` | members list; workspace settings sections load; model catalog; GPU panel; ingestion jobs show "Created by" and the per-job Notifications switch |
| `jobs-and-notifications.spec.ts` | running-jobs card appears while a model runs, cancel from the card, counts; bell entry opens the exam; a regular user gets no toast for automatic runs; Settings toggle mutes automatic notifications |
| `refresh-and-citations.spec.ts` | "Refresh study from PACS" adds new series in place without reload; chat answer shows `[n]` chips that open the model result popover |
| `ai-predictions.spec.ts` | page loads; My/Automatic/All runs (All only for admins, 403 otherwise); filters; expand an exam shows key results; Compare with latest; CSV export; a removed-images exam offers "Retrieve from PACS and open" |
| `login-cooldown.spec.ts` | after 3 wrong passwords on a non-existent account: cooldown notice with a countdown, Sign in re-enabled when it ends (use a fake e-mail so no real account is locked) |
| `i18n.spec.ts` | switch to French; our namespaces render translated strings |
| `release.spec.ts` | `version.json` served with no-store; no service worker registered; `env-config.js` present |
| `visual.spec.ts` | screenshots of login, work list, viewer with a study, results drawer, chat, settings; compared against the baseline taken on `main` (tolerance set once in phase 0) |

Unit tests: the 151 existing files must keep passing after each package (moved with their code).

## 9. Work packages

Format: **ID — title** · depends on · can run in parallel with. Each has tasks and exit checks. "Gates" refers to section 9.6.

### Phase 0 — safety net (on `main` code, no behaviour change)

**P0.1 — Acceptance suite** · none · P0.2, P1.1–P1.3
- Write `tests/pacs-ai/` per section 8 with a `playwright.pacs-ai.config.ts` at `tests/pacs-ai/`.
- Add `.github/workflows/pacs-ai-acceptance.yml` (manual trigger).
- Exit: every spec passes against the live build (identical to `baseline/ohif-3.11.1-pre-3.13-upgrade`); visual comparison matches the host baseline folder. No screenshot with patient data is committed.

**P0.2 — Decisions** · none
- Record defaults from section 12 in `STATUS.md`; raise D3 with the user once, and proceed on the default.

### Phase 1 — shrink the difference (branch `integration/modular-3.11`)

**P1.4 — Rebuild history (do this first; it creates the branch)** · none
```bash
git checkout -b integration/modular-3.11 refs/upstream/v3.11.1^{commit}
git read-tree -u --reset origin/main            # index and tree = our main
git commit -m "PACS-AI changes on OHIF 3.11.1 (tree of main abe08101)"
git merge -s ours origin/main -m "Join PACS-AI history to the OHIF 3.11.1 base"
git diff --quiet origin/main HEAD               # must print nothing: trees identical
echo v3.11.1 > pacs-ai/UPSTREAM_REF
```
- Exit: `git merge-base HEAD refs/upstream/v3.13.14` prints a commit; tree equals `origin/main` before the `UPSTREAM_REF` commit.

**P1.1 — Revert formatting-only edits** · P1.4 · P1.2, P1.3
- For each OHIF file where `git diff -w --ignore-blank-lines refs/upstream/v3.11.1 HEAD -- <file>` is empty, or the diff is only quotes/wrapping/EOL (the inventory counted 59; recompute, do not trust the number), `git checkout refs/upstream/v3.11.1 -- <file>`.
- Add OHIF paths to `.prettierignore` and exclude them from lint-staged so they are not reformatted again.
- Delete `modes/{longitudinal,tmtv,basic-dev-mode}/src/index.js` after confirming the `.ts` twin is what the build resolves.
- Restore `nx.json`, docs showcase files and other docs-only edits to upstream (28 `platform/docs` files), except pages we wrote.
- Exit: gates G1–G3; modified-file count drops by at least 80.

**P1.2 — Drift guard and ledger** · P1.4 · P1.1, P1.3
- Write `pacs-ai/scripts/check-upstream-drift.sh` (6.2), `UPSTREAM_PATCHES.md` (empty table), `apply-patches.sh`.
- Add it to CI in `--report` mode. Output three numbers: modified upstream files, theme-debt files (pure class/colour diffs), ledger rows.
- Exit: script runs and prints the counts.

**P1.3 — Own config, build files and Docker** · P1.4 · P1.1, P1.2
- Create `pacs-ai/config/pacs-ai.js` from `platform/app/public/config/local_pacs_ai.js` and our edits to `default.js`. Restore `default.js`, `netlify.js` and the 22 flag-stripped config files to upstream. Build with `APP_CONFIG=config/pacs-ai.js` (copy step in the Dockerfile).
- Move `Dockerfile` edits to `pacs-ai/docker/Dockerfile.pacs-ai` (CA-certificate hook as a build context directory that stays git-ignored, Turnstile and build-ID args), `docker-compose.yml` and our nginx templates to `pacs-ai/docker/`. Restore upstream `Dockerfile` and `.docker/Viewer-v3.x/*`.
- Move `.webpack/frontendBuildVersion.js` and `platform/app/scripts/generate-env-config.js` to `pacs-ai/build/`. Reduce `webpack.base.js`, `webpack.pwa.js`, `rsbuild.config.ts` edits to one hook that requires `pacs-ai/build/extend.js` when it exists; record as ledger patches.
- Replace the hardcoded `frontendVersion` with the build-time value.
- Rename our workflows to `pacs-ai-*.yml`.
- Exit: gates G1–G4; image built from `Dockerfile.pacs-ai` serves the app; `release.spec.ts` passes.

### Phase 2 — modularize on 3.11.1 (branch `integration/modular-3.11`)

Order matters: P2.1 → P2.2 → P2.3 → (P2.4 ∥ P2.5) → P2.6 → P2.7. Within a package, move first (pure move commit), then rewire.

**P2.1 — `pacs-ai-ui` and `pacs-ai-theme` skeleton**
- Create the two packages (package.json, tsconfig, `src/index.ts`, jest config following an existing extension such as `extensions/default`). Register in `platform/app/pluginConfig.json`.
- `git mv` our components and assets out of `platform/ui/src/components/` and the unused ui-next `AIModelButton` (delete it if truly unused). ChatBox/ChatButton/AIModelButton go to a temporary `pacs-ai-ui/src/legacy/` if their final package does not exist yet.
- Provide `Typography` and `Button` in `pacs-ai-ui` with the same props our 26 pages use, built on ui-next. Change those pages' imports from `@ohif/ui` to `@pacs-ai/ui`.
- Restore `platform/ui` to upstream entirely (index files, package.json, restyled Button/Input/Select/Tooltip). Where a page loses styling, fix it in `pacs-ai-ui`, not in `platform/ui`.
- Move logos, favicons and fonts to `pacs-ai-theme`.
- Exit: `git diff --stat refs/upstream/v3.11.1 HEAD -- platform/ui` is empty; no "ours" file imports `@ohif/ui`; gates G1–G5; `visual.spec.ts` within tolerance for login, settings, members.

**P2.2 — `pacs-ai-core`**
- Move `api/*`, `pacsAPIAxios.js`, `service/*`, `utils/authenticatedSession.ts`, `utils/worklistSearchSession.ts`, `firebase.js`, update monitor, `AlertProvider`, `GlobalStateProvider`, `InferenceProcessingProvider` and the study-processing provider.
- `preRegistration`: register services (`pacsAiSessionService`, `pacsAiModelsService`, `pacsAiStudyContextService`); call `userAuthenticationService.setServiceImplementation` so DICOMweb and image loading get the bearer header; register providers with `serviceProvidersManager`; `i18n.addLocales` for our namespaces.
- Replace `GlobalStateProvider`/`useGlobalStateData` and `AvailableModelsContext` consumers with the services (keep thin React hooks `useStudyContext`, `useAvailableModels` in core).
- Restore `DicomWebDataSource/index.ts`, `initWADOImageLoader.js`, `App.tsx` provider edits, `hooks/index.ts`, and the 47 OHIF locale files plus locale `index.js` files. Our 69 JSON files move to `pacs-ai-core/src/locales/<lang>/`. Keys we changed inside OHIF namespaces: re-add through `addLocales` into the same namespace after OHIF's load, and verify with `i18n.spec.ts`.
- Create `ohifCompat/` (6.4) and route existing uses through it.
- Exit: `git diff --stat refs/upstream/v3.11.1 HEAD -- platform/i18n extensions/default/src/DicomWebDataSource/index.ts extensions/cornerstone/src/initWADOImageLoader.js` empty; images load with auth (run `viewer-shell.spec.ts`, `auth.spec.ts`, `i18n.spec.ts`); gates G1–G5.

**P2.3 — `pacs-ai-shell`**
- Move routes F2–F4, `TopNavigation`, `routes/Settings`, tour services and overlay.
- Register routes with `routes.customRoutes`. **Verify first** (unverified in analysis) whether custom routes receive the private-route and `DataSourceWrapper` wrapping ours rely on; if not, wrap inside our route elements using exports from `@ohif/app`/`@ohif/core`, or add one ledger patch to `routes/index.tsx`.
- Work list: move `routes/WorkList/*` (ours) to `pacs-ai-shell/src/worklist/`, including the pieces of the old upstream list it still needs copied in (`filtersMeta`, table pieces) rewritten on `pacs-ai-ui`/ui-next; mount at `/` via `customRoutes`. Restore upstream `routes/WorkList/*`, `index.js`, `App.css`.
- Layout template: `getLayoutTemplateModule` returning our viewer layout (from current `ViewerLayout/index.tsx` + `ViewerHeader.tsx`), using upstream's exported pieces where possible. Restore upstream `ViewerLayout`, `ViewerHeader`, ui-next `Header.tsx`, `ErrorBoundary.tsx`.
- Tour: `ohif.tours` customization computed after the server says the user has not seen it; mark seen through the service.
- Restore `routes/index.tsx` and `App.tsx` fully if possible.
- Exit: listed upstream files identical to upstream or in the ledger; specs auth, worklist, viewer-shell, tour, admin pass; gates G1–G5.

**P2.4 — `pacs-ai-inference`** · after P2.3 · parallel with P2.5
- Move `components/inference/**`, `routes/AIModels` if not already moved, `ModelFactsModal`, AIModelButton, `extensions/cornerstone/src/utils/addSegmentation.ts`, `hooks/useCandidateProcessingPoll.ts`.
- Panel module: our study browser panel that renders upstream's study browser and adds eager display-set creation, badges, legend, extra display-set fields, and the `SeriesInstanceUID` enrichment now done in `createStudyBrowserTabs.ts`. If upstream's components do not expose what is needed, copy the smallest wrapper into our package rather than editing upstream.
- Toolbar: AIModelButton and results drawer entry as toolbar buttons via `getToolbarModule`, placed by the mode.
- Restore `PanelStudyBrowser.tsx`, ui-next `StudyBrowser.tsx`, `StudyItem.tsx`, `Thumbnail.tsx`, `createStudyBrowserTabs.ts`.
- Exit: specs run-model, stored-results, study-processing pass; gates G1–G5.

**P2.5 — `pacs-ai-chat`** · after P2.3 · parallel with P2.4
- Move ChatBox and ChatButton; toolbar button via `getToolbarModule`; remove the deep import from `ViewerHeader`.
- Exit: `chat.spec.ts` passes; gates G1–G5.

**P2.6 — `modes/pacs-ai` and behaviour tweaks**
- Mode with our layout template, left panel = our study browser panel, toolbar additions, hotkey bindings (series on arrows, images on page keys), cine autoplay for US and XA in `onModeEnter`. Make it the default mode in `pacs-ai.js`; hide stock modes if that is today's behaviour (check what `main` shows).
- Restore `hotkeyBindings.ts`, `CinePlayer.tsx` (ledger for the remainder), `AppTypes.ts`, `ViewportActionBar.tsx` (ledger if needed), `Onboarding.tsx` (ledger if needed), `DataSourceWrapper.tsx` (ledger if needed), `StaticWadoClient.ts` (ledger).
- Exit: `viewer-behaviour.spec.ts` passes; gates G1–G5.

**P2.7 — Close phase 2**
- Hygiene that keeps the later 3.14 step cheap (section 3.5), in our packages: remove `propTypes`, `defaultProps` on function components, `react-test-renderer`; give every `useRef` an argument; no `forwardRef` in new code.
- Add ESLint `no-restricted-imports` rules (6.2). Switch the drift guard from report to enforce, with theme debt as the only allowed non-ledger differences (listed in `pacs-ai/THEME_DEBT.txt`).
- Run the whole acceptance suite.
- Exit: ledger ≤ 15 rows; no inverted imports; all acceptance specs pass; all unit tests pass; `STATUS.md` updated. **Stop and report to the user**: `integration/modular-3.11` is ready to be deployed to staging/production on OHIF 3.11.1 if they want an intermediate release. Do not wait for the answer to start phase 3.

### Phase 3 — upgrade (branch `integration/ohif-3.13` from `integration/modular-3.11`)

**P3.0 — Choose the pin** — see 3.1 (newest `v3.13.x` stable; today `v3.13.14`). Fetch it to `refs/upstream/<tag>`.

**P3.1 — Merge upstream**
```bash
git checkout -b integration/ohif-3.13 integration/modular-3.11
git merge --no-commit refs/upstream/<tag>
```
Resolution rules, in order:
1. Path under "ours" → keep ours.
2. Path in the ledger → take upstream, then `apply-patches.sh`; fix patches that no longer apply and regenerate them.
3. Path in `THEME_DEBT.txt` → take upstream (the theme comes back in P3.4).
4. `package.json` (root, app) and `pluginConfig.json` → take upstream, then re-add our packages and our dependencies.
5. Lockfiles → take upstream's `pnpm-lock.yaml`; delete `yarn.lock`/`bun.lock`; regenerate with `pnpm install --no-frozen-lockfile` in the Node 24 container.
6. Files we deleted that upstream modified (`platform/app/src/service-worker.js`, `platform/app/.env`, `.netlify/build-deploy-preview.sh`) → take upstream's version (they are upstream-owned; our kill switch lives in `pacs-ai/build`).
7. Files we modified that upstream deleted (`nx.json`, `addOns/externals/devDependencies/package.json`, `DicomUpload.css`, docs showcase pages, `versioned_docs/version-3.10/*`) → accept the deletion. The `addOns` bumps (moment, postcss, webpack-dev-server) become pnpm `overrides` only if still needed.
8. Anything else → take upstream and write down what was lost in `STATUS.md`.
- Update `pacs-ai/UPSTREAM_REF`. Commit the merge even if the build is red; the following packages fix it.
- Exit: merge committed; drift guard passes (ledger and "ours" only).

**P3.2 — Tooling** · after P3.1
- Add our packages to `pnpm-workspace.yaml`; convert their manifests to `workspace:*`; declare every imported dependency (`pnpm install`, then fix each "cannot resolve"). Known extra dependencies: `dicom-data-dictionary`, `html2canvas`, `jspdf`, `react-d3-speedometer`, `cssnano`, `firebase`, `react-query`, `dotenv`, `react-markdown`, `moment` (8 of our files; prefer date-fns 4, already upstream), `react-dates` (replace with the ui-next date picker if small, else declare).
- For each third-party dependency we add, note whether it supports React 19 (needed at the 3.14 step). Do not upgrade React now. Record the list in `STATUS.md`; `react-query` v3, `react-dates` and `react-d3-speedometer` are the ones to check.
- Port `pacs-ai/build` to rspack 2: version.json emission (check the plugin against rspack's compiler hooks), env-config generation, defines (`APP_BUILD_ID`, our `process.env.*` values — upstream dropped `dotenv-webpack`, so load dotenv in `extend.js`), COOP/COEP headers, content-hashed CSS names, service-worker kill switch asset replacing upstream's service-worker manifest plugin output. Keep the `rsbuild.config.ts` hook for `dev:fast`. Update the one-hook ledger patches for `.webpack/webpack.base.js`, `platform/app/.webpack/webpack.pwa.js`, `rsbuild.config.ts`.
- `Dockerfile.pacs-ai`: start from upstream's root `Dockerfile` at the pin (`node:24.22.2-slim`, `npm i -g pnpm@12`, `nginxinc/nginx-unprivileged:1.27-alpine`), re-add the CA-certificate hook (also `pnpm config set cafile`), build args, `APP_CONFIG=config/pacs-ai.js`. Give the build enough heap (upstream asks for 24 GB; check host memory first and lower `--max_old_space_size` if the build still passes).
- Workflows: `pacs-ai-*.yml` to pnpm and Node 24; note in `STATUS.md` that self-hosted runners need Node 24.
- `playwright.config.ts`: keep our base-URL override as a ledger patch or move it fully into `tests/pacs-ai/playwright.pacs-ai.config.ts` (preferred).
- Exit: `pnpm install --frozen-lockfile` and `pnpm run build` succeed in the Node 24 container; image builds.

**P3.3 — API migration of our packages** · after P3.2 · split by package, in parallel: core, shell, inference, chat+ui
Each subagent reads the two migration guides and fixes its package:
- `ohifCompat`: `formatDICOMDate` signature; patient name and date formatting now done by us; anything the DICOMweb data source changed (`queryLimit`, `generateWadoHeader(options)`, split-out retrieve helpers).
- Customization config in `pacs-ai.js` to the phased form; start from upstream's locked-down `default.js` and add only what we need (data source from `window._env_.APP_PUBLIC_API_URL`, `autoPlayCine`, our customizations).
- Mode: extend `@ohif/mode-basic` (`modeInstance`, `basicLayout`, `basicRoute`, `initToolGroups` options object, `modeCustomizations`); toolbar section renames.
- Layout template: rebase ours on the 3.13.14 `ViewerLayout`; providers that upstream now inserts through `serviceProvidersManager` ahead of `DialogProvider` — recheck ordering.
- Routes: `routes/index.tsx` now has a `path: '*'` not-found route and selects the work list by `workList.variant`; make sure our `/` route from `routes.customRoutes` wins, else ledger.
- Work list page: `DataSourceWrapper` data shape and `queryLimit` (set per data source in `pacs-ai.js`; choose a value that covers today's list size, record it); no imports from `routes/WorkList` or `routes/LegacyWorkList`; no `moment`.
- Tour: `shepherd.js` 15 without `react-shepherd` in our layout, `TutorialProgressOverlay` and the `Onboarding` patch.
- Translations: i18next 19; union the nine colliding namespaces (`en-US/Onboarding`, `fr/Onboarding`, `fr/StudyList`, `fr/AboutModal`, `fr/StudyBrowser`, `fr/ViewportDownloadForm`, `fr/DatePicker`, `fr/MeasurementTable`, `fr/SidePanel`): our values win where both define a key, except the last three where ours is a strict subset (take upstream).
- Study browser: upstream refactored `Thumbnail` (new `children` prop and drag wrapper) and `PanelStudyBrowser`; rebase our panel module; drop the `Thumbnail.tsx` ledger patch if `children` carries the badge.
- Segmentation service rename and DICOM-video viewport removal, if we reference either.
- Logout: our redirect must be same-origin.
- Exit per package: type check and unit tests of that package pass; no import of removed APIs (`react-shepherd`, `removeSegmentationRepresentations`, `@ohif/ui`, `routes/WorkList/filtersMeta`).

**P3.4 — Theme** · after P3.2 · parallel with P3.3
- Build the PACS-AI theme in `pacs-ai-theme` as a token set (start from upstream's dark preset in `platform/ui-next/src/themes/`; map lime `#c8f469` to `primary`/`highlight`, `#151815` to `background`, `#4C504B` and the translucent whites to `muted`/`popover`/`border`; use the `3p12-to-3p13/colors.md` table).
- Register through the theme customization and make it the default in `pacs-ai.js`; keep or hide the appearance dialog per decision D5.
- Compare `visual.spec.ts` against the phase 0 baseline. For each remaining gap (likely `NavBar`, `SidePanel` rounded and translucent chrome, `PanelSection`, the twelve recoloured icons) prefer CSS variables or a scoped stylesheet in the theme package over a ledger patch.
- Delete `THEME_DEBT.txt`; the drift guard now allows ledger and "ours" only.
- Exit: visual spec within tolerance or differences listed with screenshots in the PR for the user to accept.

**P3.5 — Rendering and data checks** · after P3.3
- With Cornerstone3D 5.6.8: XA and US cine playback and autoplay; frame rate; stack scrolling; hotkeys (including the new `esc` binding not clashing with ours); `addSegmentation` labelmap import; measurements; DICOM encapsulated PDF report display with authentication; thumbnails (lower `maxNumRequests.thumbnail`); overlays drawn by model results (stenosis and lesion drawings); multi-frame XA loading through our proxy with auth.
- Run on the three reference studies named by the user through `PACS_AI_E2E_STUDY_UIDS`.
- Exit: `viewer-behaviour`, `run-model`, `stored-results` specs pass; a short written comparison of load time for one XA study before and after.

**P3.6 — Full gate and report**
- Gates G1–G7. Update `README.md` numbers (modified upstream files, ledger rows), `STATUS.md`.
- Open the PR `integration/ohif-3.13` → `main` as a draft with: what changed for users (new upstream features now visible, e.g. the scrollbar with slice progress, 404 page, contour tools, ECG waveform display), ledger contents, test results, known gaps. **Stop. Do not merge or deploy (R1, R2).**

### Phase 4 — make it repeatable

**P4.1 — `pacs-ai/scripts/upgrade-ohif.sh <tag>`**: fetch to `refs/upstream/<tag>`, create `upgrade/<tag>` from the current integration head, merge with the P3.1 rules automated where mechanical (ours/ledger/upstream-wins), run `apply-patches.sh`, update `UPSTREAM_REF`, run install, build, drift guard, unit tests; print a summary of conflicts and failures.

**P4.2 — Canary workflow** `.github/workflows/pacs-ai-upstream-canary.yml`: weekly, runs the script against the newest upstream tag (beta included) on a throwaway branch and posts the summary as a workflow summary. No pushes to long-lived branches.

**P4.3 — Runbook** `docs/ohif-upgrade/RUNBOOK.md`: the yearly checklist (read the migration guide; run the script; fix `ohifCompat`; theme check; acceptance suite; staging; production with rollback image), and the rules of section 6.2.

**P4.4 — Dry run toward 3.14 (report only)**: run `upgrade-ohif.sh` on the newest 3.14 tag on a throwaway branch; do not fix anything. Write `docs/ohif-upgrade/NEXT-3.14.md` with conflict counts, build errors, the React 19 dependency list from P3.2, and an effort estimate. The real 3.14 upgrade waits for its stable release and the user's go-ahead.

**P4.5 — Upstream contributions** (optional, needs the user's go-ahead before opening PRs on OHIF): tour gating props, series in the viewport action bar, any other ledger row marked upstreamable.

### 9.6 Gates

| Gate | Command (inside the right Node container) | Phase 1–2 | Phase 3 |
|---|---|---|---|
| G1 install | `yarn install --frozen-lockfile` / `pnpm install --frozen-lockfile` | ✓ | ✓ |
| G2 type check | `npx tsc --noEmit -p tsconfig.json` (compare error count with the baseline on the branch point; must not increase) | ✓ | ✓ |
| G3 unit tests | `yarn test:unit:ci` / `pnpm run test:unit:ci` | ✓ | ✓ |
| G4 build | `APP_CONFIG=config/pacs-ai.js yarn build` / `pnpm run build`, then build `Dockerfile.pacs-ai` | ✓ | ✓ |
| G5 drift guard | `pacs-ai/scripts/check-upstream-drift.sh` | report until P2.7 | enforce |
| G6 acceptance | `npx playwright test -c tests/pacs-ai` against the built image | per package: listed specs; P2.7: all | all |
| G7 upstream e2e smoke | a handful of upstream Playwright specs that do not depend on OHIF's default data source (skip if they all do; say so) | – | ✓ |

Record the baseline numbers (type errors, unit test count, bundle size) in `STATUS.md` at P1.4.

## 10. How to orchestrate

### 10.1 Sequence and parallelism

```
P1.4 → { P0.1, P1.1, P1.2, P1.3 } → P2.1 → P2.2 → P2.3 → { P2.4, P2.5 } → P2.6 → P2.7
     → P3.0 → P3.1 → P3.2 → { P3.3 core | shell | inference | chat+ui , P3.4 } → P3.5 → P3.6
     → { P4.1, P4.3 } → P4.2 → P4.4
```

- At most 4 subagents at once (builds are heavy on disk and memory). Packages that touch the same files never run together; the braces above are the safe sets.
- You (the orchestrator) do the merges into integration branches, conflict resolution between packages, gate runs and `STATUS.md`. Subagents do one package each.
- After each package: review the diff yourself (move commits really are pure moves; no upstream file edited without a ledger row; no test weakened), run the gates, then merge the PR into the integration branch.
- Use a fresh reviewing subagent (give it the diff, not your opinion) for P2.2, P2.3, P3.1 and P3.3, the packages most likely to hide behaviour changes.

### 10.2 Subagent brief template

```
Goal: <one sentence>.
Repository worktree: /home/ravram/pacs-ai-wp/<id> on branch wp/<id>-<slug> (already created).
Upstream reference (read-only): refs/upstream/<tag>; read with `git show <ref>:<path>`.
Scope — files you may create or change: <paths>.
Out of scope — do not change: anything else; in particular no file outside
  extensions/pacs-ai-*, modes/pacs-ai, pacs-ai/, tests/pacs-ai unless listed above.
Tasks: <numbered list copied from the work package>.
Rules:
  - Move code with `git mv` in a commit that changes only paths and imports; behaviour changes go in later commits.
  - If you need to edit an upstream-owned file, stop and report which file and why instead of editing it.
  - Do not delete or weaken tests. Do not push to main. Do not deploy.
  - No credentials, hostnames or patient data in code, tests or commit messages.
Verification you must run and paste the result of: <gate commands and spec names>.
Report: what you changed (file list by commit), the verification output, anything you could not do and why,
  anything you noticed that contradicts the brief.
```

### 10.3 When to stop and ask the user

- Anything in R1, R2.
- An acceptance spec cannot pass because the feature cannot be rebuilt without more than 15 ledger rows.
- A PACS-AI feature would have to change visibly (layout, wording, workflow) to fit an extension point.
- Credentials or a test environment are missing (phase 0).
- Upstream publishes `v3.14.0` during the work (default: finish on 3.13.x; tell the user; 3.14 follows as its own upgrade).

Otherwise decide, record the decision in `STATUS.md`, and continue.

## 11. Definition of done

1. `integration/ohif-3.13` is on OHIF 3.13.14 (or a newer 3.13 patch), builds with pnpm 12 and Node 24 and produces a working image from `pacs-ai/docker/Dockerfile.pacs-ai`.
2. Every acceptance spec passes on that image; unit tests pass; type errors not above baseline.
3. `check-upstream-drift.sh` passes in enforce mode with at most 15 ledger rows, each with a patch file and a reason.
4. No file outside "ours" imports from "ours"; no "ours" file imports `@ohif/ui` or `@ohif/app/src`.
5. `upgrade-ohif.sh` exists and has been run once (the P4.4 dry run toward 3.14), with its report in `NEXT-3.14.md`.
6. `RUNBOOK.md`, updated `README.md` and `STATUS.md` are in the branch.
7. A draft PR to `main` describes user-visible changes, the ledger, test evidence and open risks. Nothing is merged to `main` or deployed.

## 12. Decisions and defaults

| # | Decision | Default the orchestrator uses | Status |
|---|---|---|---|
| D1 | Target version | OHIF 3.13.14 (newest stable 3.13 patch at P3.0). 3.14 later, as the first yearly run. | Decided by the user |
| D2 | Modularize before or during the upgrade | Before (phases 1–2 on 3.11.1) | Plan default |
| D3 | Stock features the fork dropped (`showWarningMessageForCrossOrigin`, `groupEnabledModesFirst`, `experimentalStudyBrowserSort`, `InvestigationalUseDialog`) | Restoring upstream files brings the three flags back as upstream code; leave them off in `pacs-ai.js`. Keep the investigational-use dialog hidden as today (our layout template does not render it) and flag it to the user as a possible regulatory question. | Ask once, proceed on default |
| D4 | Work list | Keep ours as a custom route, free of `LegacyWorkList` and `@ohif/ui`. Moving to the ui-next study list is a later project. | Plan default |
| D5 | Upstream appearance (theme) dialog | Hidden; PACS-AI theme fixed | Plan default |
| D6 | New upstream viewport backend (`useNextViewports`) | Off (upstream default) | Plan default |
| D7 | Orchestrator | Claude Fable 5.2; subagents on the same model unless the user sets another | Decided by the user |

## 13. Risks

| Risk | Mitigation |
|---|---|
| Cornerstone3D 4 → 5 changes rendering or the segmentation import | P3.5 on reference studies; `addSegmentation` isolated in `pacs-ai-inference` |
| `routes.customRoutes` lacks the wrapping our pages need, or cannot override `/` | Verified first in P2.3 and again in P3.3; fallback is one ledger patch |
| Theme tokens cannot reproduce the look | Scoped CSS in the theme package; user accepts listed differences |
| pnpm strictness exposes many undeclared dependencies | P3.2 does this before any API work |
| Our build plugin does not port to rspack | Isolated in `pacs-ai/build`; fallback is a post-build script that writes `version.json` |
| Production build needs more memory than the host allows | Check before building; lower the heap; build on another machine if needed (ask the user) |
| 3.14 lands soon and changes React and many ui-next files again | Section 3.5 rules; P4.4 dry run gives the cost early |
| Acceptance suite needs a backend and credentials | Ask the user at phase 0; unit tests and build gates cover phase 1 meanwhile |
| Disk fills during builds (it happened on 2026-11-14) | R8 |
| Hidden behaviour change during a "move" | Pure-move commits (R7), independent review on the risky packages |

## 14. Not verified (treat as hypotheses)

- Nothing has been built or run on 3.13/3.14.
- `routes.customRoutes` wrapping (private route, data source).
- `serviceProvidersManager` provider ordering relative to the router in 3.11.1.
- Whether the `children` prop of the 3.13 `Thumbnail` can carry our badges.
- Whether our build-version plugin works under rspack's compiler hooks.
- Whether `moment` and the 14 cross-package imports resolve under pnpm.
- Cornerstone3D 4 → 5 API breaks beyond OHIF's own migration guides (read the Cornerstone3D migration docs in P3.5).
- React 19 compatibility of `react-query` v3, `react-dates`, `react-d3-speedometer`, `react-markdown`, `firebase` (matters at the 3.14 step only).
- `platform/app/public/oidc-client.min.js` differs from upstream beyond whitespace and has not been read; diff it in P1.1 and restore unless there is a reason.
- The count of formatting-only files (59) and colour-swap files (99) are per-file judgments by an analysis agent; recompute in P1.1 and P1.2.
