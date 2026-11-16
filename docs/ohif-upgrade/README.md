# OHIF upgrade plan: 3.11.1 → 3.13.14, built to repeat yearly

Status: proposal, 2026-11-15. Baseline tag: `baseline/ohif-3.11.1-pre-3.13-upgrade` (main at `abe08101`, identical to the frontend running at MHI).

## Summary

PACS-AI is OHIF 3.11.1 with 629 added files and 299 modified OHIF files. None of our features use OHIF's plug-in points (extensions, modes, customizations); they are wired by hand into OHIF's own files. That is why an upgrade is expensive today.

The plan has two goals:

1. Move to OHIF 3.13.14, the latest stable release (2026-11-03), keeping every PACS-AI feature.
2. Restructure our code so the next upgrade is a merge plus a short checklist: our code in our own packages, OHIF files untouched except for a small, listed set of patches.

Order of work: shrink the difference first, modularize on 3.11.1 while production stays stable, then upgrade. Upgrading first would mean resolving 107 conflicted files by hand and doing it again next year.

OHIF 3.14 is not released (latest is `v3.14.0-beta.91`, no release branch). Target 3.13.14 now and take 3.14 as the first run of the yearly procedure.

## Where we stand

### Our fork against OHIF 3.11.1

| | Files |
|---|---|
| Added by us | 629 (platform/app 447, platform/ui 71, platform/i18n 69, platform/ui-next 23) |
| OHIF files we modified | 299 |
| OHIF files we deleted | 7 |

What the 299 modifications are:

| Kind | Files | Carry-forward cost |
|---|---|---|
| Colour and style swaps (branding) | 99 | Replaceable by a theme |
| Formatting only (Prettier, end-of-file newline) | 59 | None: revert to upstream |
| Docs and translations | 60 | Low |
| Build, config, tooling | 53 | High for the build files, low for the 22 configs |
| Behaviour changes to OHIF logic | 16 | High; listed below |
| Hook-ins (import and mount our component) | 12 | Replaceable by extension points |

The 16 behaviour changes:

| File | Change |
|---|---|
| `platform/app/src/routes/WorkList/WorkList.tsx` | Our own study list (+1166/−615) |
| `platform/app/src/routes/DataSourceWrapper.tsx` | Data source error modal disabled |
| `platform/app/public/init-service-worker.js` | Service worker replaced by unregister-and-purge |
| `extensions/default/src/ViewerLayout/index.tsx` | Top navigation, model context, results provider, tour, title |
| `extensions/default/src/Panels/StudyBrowser/PanelStudyBrowser.tsx` | Eager display sets, selected-view badges, legend |
| `extensions/default/src/DicomWebDataSource/index.ts` | Bearer session token |
| `extensions/default/src/DicomWebDataSource/utils/StaticWadoClient.ts` | Bulk data URI rewritten to our proxy |
| `extensions/cornerstone/src/initWADOImageLoader.js` | Bearer session token |
| `extensions/cornerstone/src/components/CinePlayer/CinePlayer.tsx` | Autoplay for US and XA, position |
| `platform/core/src/defaults/hotkeyBindings.ts` | Arrow keys and page keys swapped |
| `platform/core/src/utils/createStudyBrowserTabs.ts` | SeriesInstanceUID copied onto tab display sets |
| `platform/core/src/types/AppTypes.ts` | Config keys removed |
| `platform/ui-next/src/components/Onboarding/Onboarding.tsx` | Per-user tour gating |
| `platform/ui-next/src/components/Errorboundary/ErrorBoundary.tsx` | `showNotification` prop |
| `platform/ui-next/src/components/Header/Header.tsx` | Left and right blocks removed |
| `platform/ui-next/src/components/Viewport/ViewportActionBar.tsx` | Current series shown |

Structural problems found:

- **Inverted dependencies.** `platform/ui`, `platform/ui-next` and `extensions/default` import from `@ohif/app/src/...` (14 files). pnpm's strict linking in 3.13 may not resolve these.
- **50 of our components live inside the old `@ohif/ui` package** (ChatBox, AIModelButton, AdminTable, Sidebar, Logo, buttons), and 26 of our pages import `Typography`/`Button` from it. Upstream has frozen `@ohif/ui`; it is used only by the legacy work list and will be removed with it.
- **Stock features lost in the fork.** `showWarningMessageForCrossOrigin`, `groupEnabledModesFirst` and `experimentalStudyBrowserSort` have no references left, and `InvestigationalUseDialog` is no longer rendered in the viewer. Whether this was intended is not recorded.
- **Stale duplicates.** `modes/{longitudinal,tmtv,basic-dev-mode}/src/index.js` sit next to upstream's `index.ts`.
- **No shared git history with OHIF.** The fork was imported as files, so git cannot do a three-way merge against upstream.

### What 3.13.14 brings

733 upstream commits: 28 features, 197 fixes. Patch releases 3.13.1 to 3.13.14 are almost all security dependency updates.

| Area | Change |
|---|---|
| Tooling (breaking) | yarn + lerna + nx → pnpm 12 workspaces; webpack → rspack 2; Node ≥ 24; `yarn.lock`, `bun.lock`, `nx.json`, `addOns/` removed |
| Rendering engine | Cornerstone3D 4.5 → 5.6 (major), vtk.js 32 → 36, dcmjs 0.43 → 0.52 |
| Work list | New ui-next study list at `/` with preview panel; the old one kept as `LegacyWorkList` behind `workList.variant: 'legacy'` |
| Theming | Token-based themes (`platform/ui-next/src/themes`), appearance dialog, legacy colours mapped to tokens |
| Customization | Phased config (`requires`/`bootstrap`/`global`/`mode`), `?customization=` URL, mode panels and toolbars as customizations |
| Modes | New `modes/basic`; other modes inherit from it |
| Onboarding | `react-shepherd` removed; direct `shepherd.js` 15 |
| Security | Hardened dynamic config URLs, same-origin logout redirect, report-only CSP, OIDC fixes |
| Features | Contour segmentation tools, ECG waveform display, compressed SEG, scrollbar with slice progress, 404 page, new viewport backend (opt-in) |
| Fixes | Segmentation hydration and layout bugs, SR rehydration, palette colour images, RTSTRUCT on multiframe, MPR crosshairs |

Extension points available in 3.13.14 that cover our hook-ins:

| Our need | Extension point |
|---|---|
| Our pages (login, members, settings, …) | `routes.customRoutes` customization (also present in 3.11.1) |
| App-wide providers | `serviceProvidersManager.registerProvider` |
| Auth header on DICOMweb and image loading | `userAuthenticationService.setServiceImplementation` from an extension's `preRegistration` |
| Viewer shell (top navigation, contexts) | Our own `layoutTemplateModule` |
| Panels, toolbar buttons | `getPanelModule`, `getToolbarModule`, mode-scope customizations |
| Header content, menus, tours | `ohif.menuContent`, `ohif.tours`, `whiteLabeling` |
| Branding | Theme JSON plus `ActiveThemeProvider` |
| Translations | `i18n.addLocales` from our extension |
| Hotkeys, autoplay cine | App config and `ohif.hotkeyBindings` |

### Simulated merge onto 3.13.14

A real three-way merge was run in a scratch object store (base 3.11.1, ours main, theirs 3.13.14).

| Outcome | Files |
|---|---|
| Clean | 65 |
| Textual conflicts | 76 (152 hunks) |
| Same new path added by both | 9 (translation files) |
| We modified, upstream deleted | 19 |
| We deleted, upstream modified | 3 |

About 33 of the conflicted files are colour swaps. Files that merge cleanly but break at build time: our work list imports files upstream moved to `LegacyWorkList/`; three of our files import the removed `react-shepherd`; our scripts and workflows still call `yarn`.

### What 3.14 will add (from beta.91)

- React 18.3 → 19.2 with the React Compiler applied to every `src/` under `platform/`, `extensions/*` and `modes/*`.
- Production build moves to rsbuild; ESLint 10 flat config.
- Cornerstone3D 5.6 → 5.18; display sets move into the Cornerstone metadata cache.
- `LegacyWorkList`, `workList.variant` and `@ohif/ui` are deprecated, not yet removed.
- New keys useful to us: `ohif.headerRightSide`, `studyBrowser.thumbnailDetails`.
- 108 of the 299 OHIF files we modify change again, mostly mechanical React 19 cleanup in ui-next.

Consequence for the design: every direct edit to a ui-next file conflicts again in 3.14. Wrappers and customizations do not.

## Target structure

All PACS-AI code lives in packages we own. OHIF directories stay byte-identical to the pinned upstream tag, except for patches listed in a ledger.

```
extensions/
  pacs-ai-core/        API client, session and auth, services, app providers, translations
  pacs-ai-shell/       routes (login, register, members, settings, workspace settings),
                       top navigation, viewer layout template, work list page
  pacs-ai-inference/   run model, series selection, study processing, stored results,
                       study browser badges, result renderers
  pacs-ai-chat/        chat assistant
  pacs-ai-ui/          our UI primitives (moved out of @ohif/ui), logos, assets
  pacs-ai-theme/       theme tokens (lime on dark), fonts
modes/
  pacs-ai/             extends modes/basic: our layout template, panels, toolbar, hotkeys
pacs-ai/
  build/               build-version plugin, env-config generator
  docker/              Dockerfile.pacs-ai, nginx templates
  config/              pacs-ai.js app config (selected with APP_CONFIG)
  UPSTREAM_PATCHES.md  ledger of every OHIF file we still edit
  scripts/             upgrade-ohif.sh, check-upstream-drift.sh
```

Rules:

1. **Dependency direction.** `pacs-ai-*` packages may import `@ohif/core`, `@ohif/ui-next` and each other. Nothing under `platform/` or OHIF's `extensions/` may import a `pacs-ai-*` package or `@ohif/app/src`. An ESLint `no-restricted-imports` rule enforces it.
2. **Registration, not editing.** Features attach through `pluginConfig.json` and the app config: routes via `routes.customRoutes`, providers via `serviceProvidersManager`, auth via `userAuthenticationService`, viewer chrome via our layout template, branding via the theme.
3. **Patch ledger.** Each remaining edit to an OHIF file gets a row in `pacs-ai/UPSTREAM_PATCHES.md`: file, reason, how to re-apply, whether it can be sent upstream. Target: 15 files or fewer, down from 299.
4. **Drift guard in CI.** `check-upstream-drift.sh` compares every path outside our packages with the pinned upstream tag and fails if a differing file is not in the ledger.
5. **One access point for OHIF APIs likely to change.** Customization reads go through one hook of ours (swappable for `useCustomization` in 3.14); display set and viewport access go through one adapter module.
6. **Real upstream history.** The integration branch is built on upstream's own commits so `git merge v3.x.y` is a true three-way merge from now on.

## Phases

Each phase ends with something deployable. Phases 1 and 2 stay on OHIF 3.11.1, so production risk is limited to refactoring.

### Phase 0: safety net

- [x] Tag the current main (`baseline/ohif-3.11.1-pre-3.13-upgrade`).
- [ ] Write the acceptance suite as Playwright tests against a deployed build: login and tenant, work list search and open, run a model with series selection, stored results drawer, study processing status, chat with tool activity, viewer tour once per user, members and workspace settings, cine autoplay on XA, hotkeys.
- [ ] Capture screenshots of each screen as the visual reference for the theme work.
- [ ] Decide the four lost stock features (keep removed, or restore).

Exit: the suite passes on today's main.

### Phase 1: shrink the difference (on 3.11.1)

- [ ] Revert the 59 formatting-only files to upstream; exclude OHIF directories from our Prettier and lint-staged runs.
- [ ] Delete the stale `modes/*/src/index.js` duplicates.
- [ ] Move our settings from `default.js`/`netlify.js` into `pacs-ai/config/pacs-ai.js`; restore the 22 OHIF config files.
- [ ] Rebuild history: start `integration/ohif` from upstream's `v3.11.1` commit, add our tree as one commit, and join main to it with a merge so both histories are kept.
- [ ] Add the ledger and the drift guard (report-only at first).

Exit: modified OHIF files drop from 299 to about 210; acceptance suite passes.

### Phase 2: modularize (on 3.11.1)

In this order, one pull request per step:

1. **`pacs-ai-ui`.** Move our 50 components and assets out of `platform/ui`. Replace `Typography`/`Button` imports from `@ohif/ui` in our 26 pages with ui-next components or our own. Restore `platform/ui` to upstream.
2. **`pacs-ai-core`.** Move `api/`, `pacsAPIAxios.js`, `service/`, session utilities. Register the auth implementation with `userAuthenticationService`; this removes the edits in `DicomWebDataSource/index.ts` and `initWADOImageLoader.js`. Register our translations with `i18n.addLocales`. Replace `GlobalStateProvider` with a service.
3. **`pacs-ai-shell`.** Move the routes behind `routes.customRoutes`; move providers behind `serviceProvidersManager` (keep a ledger patch for any provider that must sit inside the router). Create our layout template from `ViewerLayout`; restore upstream's `ViewerLayout`, `ViewerHeader` and `Header`. Mount our work list as a custom route at `/`.
4. **`pacs-ai-inference` and `pacs-ai-chat`.** Move `components/inference/**` (197 files) and ChatBox. Provide the study browser as our own panel module wrapping upstream's, so `PanelStudyBrowser.tsx`, `StudyBrowser.tsx`, `StudyItem.tsx` and `Thumbnail.tsx` go back to upstream.
5. **`modes/pacs-ai`.** Our layout, panels, toolbar additions, hotkey bindings, cine autoplay.
6. **Hygiene for 3.14.** Remove PropTypes and `defaultProps` from our code; replace `react-test-renderer`; route customization reads through our hook.

Exit: drift guard enforced; ledger at 15 files or fewer plus the theme files; acceptance suite passes; deployed to MHI and stable for a week.

Expected ledger after phase 2: `StaticWadoClient.ts` (proxy rewrite, unless `bulkDataURI.transform` covers it), `DataSourceWrapper.tsx`, `Onboarding.tsx`, `ErrorBoundary.tsx`, `ViewportActionBar.tsx`, `createStudyBrowserTabs.ts`, `CinePlayer.tsx` position, `App.tsx` if a provider needs the router, build files.

### Phase 3: upgrade to 3.13.14

1. **Tooling first, on a branch.** Node 24, pnpm 12, regenerate the lockfile, add our dependencies to the right packages (pnpm will expose undeclared ones). Port the build-version plugin to rspack. Write `pacs-ai/docker/Dockerfile.pacs-ai` from upstream's (CA certificates, Turnstile and build-ID arguments). Convert our workflows to pnpm; self-hosted runners need Node 24.
2. **Merge `v3.13.14`** into `integration/ohif`. For every OHIF file not in the ledger, take upstream. Re-apply ledger patches by hand.
3. **Theme.** Take upstream for the 33 colour-swap files; express our palette as a theme in `pacs-ai-theme`; compare against the phase 0 screenshots; add ledger patches only for gaps.
4. **Work list.** Keep ours as a custom route; it must not import from `LegacyWorkList/` or `@ohif/ui`. Raise the data source `queryLimit` if we rely on more than 101 studies.
5. **Tour.** Move to `shepherd.js` 15 and re-apply per-user gating; offer the gating upstream.
6. **Engine check.** Cornerstone3D 5: verify `addSegmentation.ts`, cine, XA and US display, measurement tools, the DICOM report PDF, and model result overlays on the three reference studies.
7. **Translations.** Union the 9 colliding files; i18next 17 → 19.
8. **Gates.** Type check, unit tests, drift guard, acceptance suite, visual comparison, then staging, then MHI with the previous image kept for rollback.

Exit: production on 3.13.14 with every acceptance test passing.

### Phase 4: the yearly procedure (first run: 3.14)

`pacs-ai/scripts/upgrade-ohif.sh <tag>`:

1. Fetch the tag, merge into `integration/ohif`.
2. Resolve: upstream wins outside our packages; re-apply ledger patches.
3. Read the upstream migration guide for that release; update our adapter modules.
4. Run the gates from phase 3 step 8.

Between upgrades, a weekly CI job merges the latest upstream beta into a throwaway branch and reports conflicts, build errors and failing tests, so the cost of the next upgrade is visible early.

For 3.14 specifically: React 19 codemods on our packages, exclude our packages from the React Compiler at first and opt in package by package, switch our hook to `useCustomization`, stop any writes to `getDisplaySetCache()`, migrate the work list to the ui-next study list before `LegacyWorkList` and `@ohif/ui` are removed.

## Decisions needed

| Decision | Recommendation |
|---|---|
| Target version | 3.13.14 now; 3.14 after its stable release |
| Work list | Keep ours as a custom route for 3.13; plan the move to the ui-next study list for 3.14 |
| Lost stock features and the investigational-use dialog | Product and regulatory call; needed before phase 1 ends |
| Old `@ohif/ui` | Leave it for upstream's legacy work list only; none of our code depends on it after phase 2 |
| Send patches upstream | Tour gating, `ErrorBoundary` prop, series in the viewport action bar: each one accepted removes a ledger row |

## Effort (estimate, one engineer familiar with the code)

| Phase | Weeks |
|---|---|
| 0 Safety net | 1 |
| 1 Shrink the difference | 1 |
| 2 Modularize | 3 to 4 |
| 3 Upgrade to 3.13.14 | 3 to 4 |
| 4 First 3.14 run, once released | 2 |

These are judgment, not measured. The largest unknowns are how much Cornerstone3D 5 changes behaviour for our segmentation import and cine, and how much of the theme upstream's tokens reproduce.

## Not verified

- Nothing was built or run on 3.13.14 or 3.14; all findings come from reading and diffing the trees.
- Whether `routes.customRoutes` gives custom pages the same data source and private-route wrapping our routes rely on.
- Whether the thumbnail badge fits through upstream's `children` prop.
- Cornerstone3D 4 → 5 API breaks beyond OHIF's own migration guides.
- `platform/app/public/oidc-client.min.js` differs from upstream beyond whitespace and was not read.
