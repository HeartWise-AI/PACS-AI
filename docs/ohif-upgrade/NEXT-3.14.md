# Next step: OHIF 3.14 (dry run, report only)

PLAN P4.4. `pacs-ai/scripts/upgrade-ohif.sh --keep-going --typecheck latest:v3.14`
on 2026-11-18 resolved **`v3.14.0-beta.98`** (`e2541aaf6`, newest 3.14 tag that
day; no 3.14 stable yet), from `wp/P4.1-repeatable` (= `integration/ohif-3.13`
@ 6ac260799 + the P4 tooling), in a throwaway clone; nothing was fixed, the
branch was deleted. 202 upstream commits, 880 files changed since v3.13.14.
The real step waits for the 3.14 stable release and the owner's go-ahead.

## Merge

Git's merge base is `43f3f4550` (`3.13.0-beta.135`, where the 3.13 release
line left master; 30 commits below v3.13.14), not v3.13.14, as at the 3.13 step; the rules (three-way against v3.13.14) make
that harmless: no clean git merge had to be reset, no edit of ours was lost.

| Rule | Paths | Git conflicts |
|---|---:|---:|
| 1 ours: kept | 958 | 1 (`.github/CODEOWNERS`: upstream added one; ours kept) |
| 2 ledger: upstream + patch | 7 | 1 (`rsbuild.config.ts`) |
| 3 theme debt | 0 | 0 |
| 4 manifests: upstream + ours | 3 | 2 |
| 5 lock files | regenerated | 1 |
| expected files (three-way) | 7 | 2 (`pnpm-workspace.yaml`, `version.txt`; both resolved) |
| 6 / 7 deleted on one side | 0 | 0 |
| 8 other upstream-owned: upstream | 868 | 33 (29 package version lines, `Dockerfile`, `.circleci/config.yml`, two `dicom-pdf` files) |

Needs a person (4):

- `package.json`: upstream brings ESLint back at **10.7.0** with
  `@typescript-eslint/parser` 8.64.0 and `eslint-plugin-react-hooks` 7.1.1;
  ours pinned 8.57.1 / 6.21.0 / 4.6.2 for `lint-imports.sh`. Upstream's kept.
- Patch **0003** (`rsbuild.config.ts`) no longer applies (below).

The drift guard passes on the merge (14 modified upstream files = 6 ledger + 8
expected; 0 unexplained, 0 import violations).

## Ledger patches

| Patch | Result on beta.98 | Action at 3.14 |
|---|---|---|
| 0001 webpack.base | applies (refreshed) | keep; check it still matters (below) |
| 0002 webpack.pwa | applies (refreshed) | keep for `dev`/`build:legacy`, or retire if we drop the rspack path |
| 0003 rsbuild | **does not apply**: `rsbuild.config.ts` rewritten (+463/−230) | regenerate on the new file; it is now the main build |
| 0004 StaticWadoClient | applies | **retire**: upstream #6319 (from `v3.14.0-beta.85`) applies `bulkDataURI.transform` to absolute URIs in `fixBulkDataURI`; every metadata bulk data value goes through it (`addRetrieveBulkDataNaturalized`, `cleanDenaturalizedDataset`). Put the rewrite (`http://orthanc:8042` and the API origin → `<API>/proxy`) in `pacs-ai.js` as `bulkDataURI.transform`; verify the encapsulated PDF, SR and thumbnails through the proxy on the server |
| 0005–0007 | apply | keep |

## Checks

| Check | Result | Cause |
|---|---|---|
| install (`--frozen-lockfile`, regenerated lock) | pass | |
| build | **fail** | `platform/app` `build` is now `rsbuild build --config ../../rsbuild.config.ts` (rspack stays as `build:legacy`/`dev`). Without our hook (0003) the build looks for `platform/app/public/config/pacs-ai.js`. Port `pacs-ai/build/extend.js` to the rsbuild config and regenerate 0003 |
| lint-imports | **fail** | ESLint 10 is flat-config only (`--no-eslintrc`, `.eslintrc.json` unsupported). Either move `pacs-ai/eslint/*` and the per-package `.eslintrc.json` to `eslint.config.js`, or run our import rules with a pinned ESLint 8 outside the root manifest |
| unit tests | **fail** | upstream packages all pass; ours: see below |
| drift guard | pass | |
| ledger on a fresh tag | fail | 0003 |

### Unit tests by package (`pnpm -r --no-bail --no-sort run test:unit:ci`)

| Package | Result | Cause |
|---|---|---|
| core, chat, ui, mode, app | pass (51, 9, 5, 1, 4 suites) | |
| theme | 1 suite / 3 tests fail | `upstreamAnchors.test.ts`: three class strings our stylesheet matches are gone (work list item 10) |
| shell | 3 suites / 7 tests fail | `index.test.ts`, `PacsAiCinePlayer.test.tsx`: `Cannot read properties of null (reading 'useMemoCache')`, i.e. two Reacts: 3.14 compiles with the React Compiler (its output needs React 19) while our packages still resolve React 18.3.1 (item 1). `displaySetOrder.test.ts` (4): the "3.13 as shipped" arrival-order expectations no longer hold because upstream now sorts `activeDisplaySets` (item 6) |
| inference | 8 suites / 21 tests fail | `@testing-library/react` 13 on React 19 (`unmountComponentAtNode is not a function`, `react-dom/test-utils` `act`): `useStudyRefresh`, `useStudyProcessingRunPoll`, `ViewerRunningJobsIndicator`, `StudyProcessingStatus`, `StudyReprocessAction`; the React Compiler transform inside `jest.mock` factories (`Invalid variable access: _c`): `PacsAiThumbnail.test.tsx`, `PacsAiTrackedSeriesListPanel.test.tsx` (mocks with inline components must move out of the factories or be named `mock*`); `runModelSeriesOrder.test.ts`: `createStudyBrowserTabs` now needs `displaySetService.getSortCriteria` (item 5) |

Note: a plain `pnpm -r --no-bail run` skips every package that depends on a
failing one (here all of ours after `@pacs-ai/theme`); the script runs the
tests with `--no-sort` so each package reports.

### Type errors in our own files (tsc per package; total includes upstream files it reaches)

| Package | v3.13.14 (total / own) | beta.98 (total / own) | New errors in our files |
|---|---|---|---|
| core | 332 / 9 | 348 / 10 | `ohifCompat/viewportElement.ts`: `useViewportRef` removed (use `useViewportElement`) |
| ui | 294 / 4 | 311 / 8 | `Button.tsx` (2), `SelectSeriesModal.tsx`: React 19 types (`ref`, `children` typed `unknown`) |
| chat | 346 / 4 | 368 / 5 | `MessageBubble.tsx`: `alt` on `ReactMarkdownProps` (react-markdown 8 types vs React 19) |
| inference | 1167 / 35 | 1218 / 40 | `createStudyBrowserTabs` takes 5 arguments now (adds `displaySetService`; `PacsAiPanelStudyBrowser.tsx` and its test); `PacsAiThumbnail.tsx`: react-dnd `ConnectDragSource` not a React 19 `Ref`; cs3d typings (our pin 5.6.8 vs upstream 5.18.3) |
| shell | 1048 / 23 | 1098 / 23 | none new |
| theme | 19 / 0 | 40 / 0 | none |
| mode | 1159 / 0 | 1209 / 0 | none |

## Work list for 3.14 (from the migration guide `3p13-to-3p14`)

| # | Area | What changes for us | Our files |
|---|---|---|---|
| 1 | React 19 (`react-19.md`) | React 19.2.7 everywhere; ui-next takes react as a peer. Our manifests pin `react`/`react-dom` **18.3.1** (peer and dev): pnpm installs 19.2.7 for the app and reports unmet peers for every package of ours, and third-party libraries resolved in our packages' context still see 18. Move the pins to 19 (or `workspace` ranges) and handle the libraries below | all `extensions/pacs-ai-*/package.json`, `modes/pacs-ai/package.json` |
| 1b | React Compiler | 3.14's Babel config compiles components with the React Compiler, including ours (shared root config) and code inside `jest.mock` factories | test mocks in inference; check our components for render-time side effects |
| 2 | React 19 libraries (STATUS P3.2 list) | `react-query` 3.39.3 (core, shell): no React 19, move to `@tanstack/react-query` 5; `react-dates` 21.8.0 (shell): replace with the ui-next date picker; `react-d3-speedometer` 2.2.1 (inference): 3.x; `react-select` 5.7.4 (shell): 5.10.x; `@testing-library/react` 13.4.0 (all, dev): 16.x; `react-markdown` 8 / `remark-gfm` 3 (chat): work, types need a fix (10.x optional); `forwardRef` in `@pacs-ai/ui` `Input` still works (deprecated in 19) | core, shell, inference, chat, ui |
| 3 | Viewport element hooks (`use-viewport-refs.md`) | `useViewportRef` removed: `ohifCompat/viewportElement.ts` → `useViewportElement` (the adapter is the only caller) | core `ohifCompat/` |
| 4 | `useCustomization` (`use-customization.md`) | With the React Compiler, `customizationService.getCustomization` during render can freeze at a stale value. Our render-time calls: `PacsAiPanelStudyBrowser.tsx` (`studyBrowser.studyMode`, `studyBrowser.viewPresets`), `PacsAiViewerLayout.tsx` (`ui.loadingIndicatorProgress`); the double-click handler and `ViewerTour.tsx` read it outside render (fine); switch `ohifCompat/useSafeCustomization` to upstream's `useCustomization` (PLAN 6.4) and use it there | core, inference, shell |
| 5 | Study browser | `createStudyBrowserTabs(…, displaySetService)`; `studyBrowser.thumbnailDetails` customization (detail line under the thumbnail); `activeDisplaySets` now sorted by upstream (#6399, from beta.91). Three-way merge our study browser copies again (as P3.3b) | inference `studyBrowser/*` |
| 6 | Display set order | `DisplaySetService` keeps `activeDisplaySets` in the default sort order: our `viewerBehaviour/displaySetOrder.ts` (re-sort on DISPLAY_SETS_ADDED/CHANGED) can retire; re-run `viewer-behaviour` (arrow keys, Series label) | shell `viewerBehaviour/` |
| 7 | Display set storage (`display-set-store.md`) | `getDisplaySetCache()` is a read-only copy; we never write to it (`ohifCompat/displaySets.ts`) | none |
| 8 | Build | rsbuild is the app build (above); `Dockerfile.pacs-ai` to upstream's 3.14 `Dockerfile` (Node 24.22.2 and pnpm 12 unchanged; nginx base `1.27-alpine` → `1.30-alpine`) | `pacs-ai/build`, `pacs-ai/docker`, ledger 0001–0003 |
| 9 | ESLint 10 | flat config (above) | `pacs-ai/eslint`, `pacs-ai/scripts/lint-imports.sh`, per-package `.eslintrc.json` |
| 10 | Theme | `upstreamAnchors.test.ts`: 3 anchors gone (`DicomTagTable.tsx` "relative m-auto border-2 border-background bg-background"; `StudyBrowserSort.tsx` two class strings): update the rules in `pacs-ai-theme.css`; check new tokens in upstream's presets; visual spec | theme |
| 11 | Cornerstone3D 5.6.8 → 5.18 (`multi-resolution-volumes.md`) | inference pins `@cornerstonejs/core` 5.6.8 (unmet peer of `@ohif/core`): use upstream's version. Volumes load with `coarseInterleavedRetrieveStages`; the "Transient Low Fidelity" label while loading; check `addSegmentation` (labelmap) and XA/US cine on the server | inference `utils/addSegmentation.ts`, manifest |
| 12 | Hanging protocols (`hanging-protocol-comparisons.md`), split rules | `greaterThan`/`lessThan` strict; we define no protocol (stock ones only). Split rules are opt-in, off by default | none expected; check first hanging of XA/US |
| 13 | WorkList (`work-list.md`) | `LegacyWorkList` and `workList.variant` deprecated (not removed); we use neither (our `/` is a custom route, `showStudyList` off) | none |
| 14 | Report dialog, InputNumber, DataTable, SmartScrollbar, `useSegmentationExpanded`, `createContext` | not used by our packages | none |

## Upstream features that let us drop our code

- **0004** → `bulkDataURI.transform` (#6319).
- **`displaySetOrder.ts`** → `DisplaySetService._sortActiveDisplaySets` (#6399).
- **`useSafeCustomization`** → `useCustomization` from `@ohif/core`.
- **Study browser copies** (`PacsAiThumbnail` etc., ~1,700 lines): 3.14's
  `studyBrowser.thumbnailDetails` puts configurable items on the detail line
  under the thumbnail, not over the image. Enough only if the owner accepts the
  selected-view badge as a detail item; otherwise the copies stay (or upstream
  takes the overlay slot proposed in `UPSTREAM-CONTRIBUTIONS.md` item 5).
- **Tour gating, Series label**: still not upstream (contributions 2 and 3).

## Effort estimate

| Work | Days |
|---|---:|
| Build: rsbuild hook (0003), `extend.js` port, Dockerfile | 1 |
| ESLint 10 flat config for the import rules | 0.5–1 |
| React 19: manifests, `@tanstack/react-query` 5 (core, shell), date picker for `react-dates`, speedometer 3, react-select, testing-library 16, type fixes in ui/chat/inference | 3–4 |
| ohifCompat (`useViewportElement`, `useCustomization`) and render-time customization reads | 0.5 |
| Study browser copies: three-way merge with 3.14, `createStudyBrowserTabs` | 1–1.5 |
| Retire 0004 and `displaySetOrder.ts`, with server checks | 0.5–1 |
| Theme anchors, new tokens, visual compare | 0.5–1 |
| Cornerstone3D 5.18 checks, acceptance suite, reference runs (re-record if the studies changed), rendering checks, staging | 2–3 |
| **Total** | **9–13 working days** |

The merge itself is mechanical (the script); most of the time is React 19
in our dependencies and the server checks. Starting before 3.14 is stable
would mean re-running the script on each beta; the canary shows the drift
weekly.
