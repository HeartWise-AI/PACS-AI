# Contributions to OHIF (P4.5)

PLAN P4.5: contributions that would let PACS-AI drop a ledger row or a copy of
upstream code. **Opened on 2026-11-18** with the owner's go-ahead, from the fork
`robertavram-md/Viewers` (generic changes only; nothing about PACS-AI). OHIF has
no CLA. Each PR ran OHIF's checks (PR_CHECKS, dependency audit, Netlify preview)
and got automated reviews (CodeRabbit, Codex); the review points were addressed
in follow-up commits on each branch.

| # | OHIF PR | Base | What it adds |
|---|---|---|---|
| 1 | [#6444](https://github.com/OHIF/Viewers/pull/6444) | `master` | `OHIF_BUILD_EXTEND`: a module that extends the rsbuild / rspack config |
| 2 | [#6445](https://github.com/OHIF/Viewers/pull/6445) | `master` | `ohif.tourPersistence`: async "tour shown" store; recorded when a step is displayed |
| 3 | [#6447](https://github.com/OHIF/Viewers/pull/6447) | `master` | `ohif.seriesIndicator` toolbar item ("Series n/N · #number description"), opt-in |
| 4 | [#6446](https://github.com/OHIF/Viewers/pull/6446) | `release/3.13` | backport: stable `activeDisplaySets` order (active-order part of #6399) |
| 5 | [#6448](https://github.com/OHIF/Viewers/pull/6448) | `master` | `studyBrowser.thumbnailOverlay`: a component drawn over each thumbnail image |

When they are merged: #1 lets us replace patches 0001–0003 with
`OHIF_BUILD_EXTEND=pacs-ai/build/extend.js` (the module then exports
`rsbuild`/`rspack`); #2 replaces the tour gating in the shell with an
`ohif.tourPersistence` backed by our API; #3 replaces `CurrentSeriesLabel`
with `seriesIndicator` in `viewportActionMenu.topMiddle`; #4 (if released on
3.13.x) retires `displaySetOrder.ts` before 3.14; #5 lets the inference package
drop its study browser copy for upstream's panel plus a customization.

Original analysis, checked against `v3.13.14` (our pin) and `v3.14.0-beta.98`
(newest tag on 2026-11-18):

| # | Contribution | What it retires for us | Status upstream (beta.98) | Size |
|---|---|---|---|---|
| 1 | Build extension hook | ledger rows 0001–0003 | not present | S |
| 2 | Server-side tour persistence | the tour gating in `@pacs-ai/extension-shell` | not present (localStorage only) | S–M |
| 3 | Current-series indicator in the viewport action bar | `CurrentSeriesLabel` in the shell | not present | M |
| 4 | Deterministic `activeDisplaySets` order (backport to 3.13) | `viewerBehaviour/displaySetOrder.ts` | **fixed on master** (#6399, from beta.91); not on the 3.13 line | S |
| 5 | Overlay slot on study browser thumbnails | our `PacsAiThumbnail` copy (badges) | `studyBrowser.thumbnailDetails` (detail line only) | M |
| – | Bulk data URI transform for absolute URIs | ledger row 0004 | **fixed on master** (#6319, from beta.85) | none needed |

## 1. Build extension hook (ledger 0001–0003, "upstreamable: yes")

**Problem.** A downstream app cannot add build-time defines, copy its own
public files or adjust the dev server without editing upstream's build
configs: the define table and plugin list are local to
`.webpack/webpack.base.js`, `platform/app/.webpack/webpack.pwa.js` and
`rsbuild.config.ts`, and `APP_CONFIG` can only select a file under
`platform/app/public/config`.

**Proposal.** One optional hook at the end of each config: when the
environment variable `OHIF_BUILD_EXTEND` (or a file next to the config) names
a module, call `module(config, { mode, isDev, env })` and use what it returns.
Ten lines per config, no behaviour change when unset. In 3.14 the app build
runs on rsbuild (`rsbuild build --config ../../rsbuild.config.ts`), so
`rsbuild.config.ts` is the first target; webpack/rspack configs follow.

**Files.** Upstream: `rsbuild.config.ts`, `platform/app/.webpack/webpack.pwa.js`,
`.webpack/webpack.base.js`. Ours: `pacs-ai/patches/0001-0003-*.patch`,
`pacs-ai/build/extend.js`.

## 2. Server-side tour persistence

**Problem.** `Onboarding` (`platform/ui-next/src/components/Onboarding/`)
decides whether a tour was shown with `hasTourBeenShown`/`markTourAsShown`,
which read and write `localStorage['shownTours']`. A product that must show a
tour once per user across browsers and devices has to pre-filter `ohif.tours`
and clear the local flag itself, and learns that a tour really started only by
wrapping the first step's `show` handler. That is what
`extensions/pacs-ai-shell/src/tour/{ViewerTour.tsx,viewerTours.ts,reportTourShown.ts}`
does.

**Proposal.** An optional customization, e.g. `ohif.tourPersistence`:
`{ hasBeenShown(tourId): boolean | Promise<boolean>, markShown(tourId): void | Promise<void> }`,
defaulting to the current localStorage functions; `Onboarding` awaits
`hasBeenShown` before starting a tour and calls `markShown` when the first
step is displayed (not when the tour is created).

**Files.** Upstream: `platform/ui-next/src/components/Onboarding/Onboarding.tsx`,
`utilities.ts`; docs `platform/docs/docs/configuration/tours.md`. Ours: the three shell files above.

## 3. Current-series indicator in the viewport action bar

**Problem.** Users who move through series with the arrow keys need to see
which series the viewport shows and where it sits in the study ("Series 3/19
· #5 LAO 30"). 3.13 shows no series position anywhere in the viewport; the
3.11 fork showed it in its edited viewport action bar (feature F15), and
PACS-AI now adds a toolbar item in `viewportActionMenu.topMiddle`.

**Proposal.** A stock viewport action corner item (e.g.
`ohif.viewportActionMenu.seriesIndicator`) that modes can place: "Series n/N ·
#SeriesNumber SeriesDescription", with n/N counted among the image display
sets of the shown series' study in study browser order. Lessons from our
version: count frames with `numImageFrames`/`instances` (OHIF fills
`imageIds` only when a viewport loads a display set, so N otherwise grows as
the user navigates); non-image series (SR, SEG, DOC, ...) show only the number
and description; the corners render on the active or hovered viewport only.

**Files.** Upstream: `extensions/cornerstone/src/components/OHIFViewportActionCorners.tsx`,
`extensions/cornerstone/src/getToolbarModule.tsx`, `modes/basic/src/index.tsx` (toolbar sections).
Ours: `extensions/pacs-ai-shell/src/viewerBehaviour/CurrentSeriesLabel.tsx`
(+ test), `modes/pacs-ai/src/index.ts` (placement).

## 4. Deterministic `activeDisplaySets` order (3.13 backport)

**Problem (found in 3.13.14, upstream too).** The DICOMweb data source stores
each series' metadata asynchronously as it arrives, so
`DisplaySetService.activeDisplaySets` is in network completion order. OHIF
re-sorts its own copies (hanging protocol, study browser tabs), but
`updateViewportDisplaySet` (next/previous series, arrow keys by default)
walks the active list, so the series that follows #1 can be #5 on one load and
#2 on the next. Reproduce: a study with 10+ series over a slow link, open it,
press ArrowDown repeatedly, reload, repeat.

**Upstream status.** Fixed on master by #6399 ("show the series in the sort
picked in the panel settings", 2026-11-13): `DisplaySetService` sorts
`activeDisplaySets` with `getSortCriteria('default')` whenever display sets
are added (`_sortActiveDisplaySets`). First tag with it: `v3.14.0-beta.91`.
Not on the 3.13 release line.

**Proposal.** Only if the owner wants it before 3.14: a backport PR of the
`_sortActiveDisplaySets` part to `release/3.13` with a unit test that adds
display sets in arrival order #1, #5, #2, #3, #4 and checks the active list
and `updateViewportDisplaySet`. Otherwise nothing: our workaround retires at
the 3.14 step (see `NEXT-3.14.md`).

**Files.** Upstream: `platform/core/src/services/DisplaySetService/DisplaySetService.ts`,
`extensions/default/src/commandsModule.ts` (`updateViewportDisplaySet`). Ours:
`extensions/pacs-ai-shell/src/viewerBehaviour/displaySetOrder.ts` (+ test).

## 5. Overlay slot on study browser thumbnails

**Problem.** PACS-AI marks thumbnails with the views an AI model used
("selected view" badges over the image). In 3.13 `Thumbnail` renders its
`children` only in the no-image placeholder, so we keep copies of
`PanelStudyBrowser`, `StudyBrowser`, `StudyItem`, `ThumbnailList` and
`Thumbnail` (~1,700 lines) in `@pacs-ai/extension-inference`. 3.14 adds
`studyBrowser.thumbnailDetails`: configurable items on the text line under the
thumbnail (value, label, icon), not over the image.

**Proposal.** A `studyBrowser.thumbnailOverlay` customization (a component
receiving `{ displaySet }`, rendered absolutely over the thumbnail image), or
render `Thumbnail`'s `children` over the image as well. With it, our panel
becomes upstream's panel plus a customization. Alternative without upstream
work: move the badge to a `thumbnailDetails` item (icon + count) if the owner
accepts the badge under the image instead of over it.

**Files.** Upstream: `platform/ui-next/src/components/Thumbnail/Thumbnail.tsx`,
`extensions/default/src/Panels/StudyBrowser/PanelStudyBrowser.tsx`. Ours:
`extensions/pacs-ai-inference/src/studyBrowser/*`.

## Not proposed

- Ledger 0004 (`StaticWadoClient` bulk data rewrite): upstream #6319 applies
  `bulkDataURI.transform` to absolute URIs from `v3.14.0-beta.85`; we retire the
  row with a `transform` in `pacs-ai/config/pacs-ai.js` at 3.14.
- Ledger 0005–0007 (`.prettierignore`, untracked `platform/app/.env`): specific
  to how we deploy; marked "no" in the ledger.
