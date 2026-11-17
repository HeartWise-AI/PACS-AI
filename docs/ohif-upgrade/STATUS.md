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
| P0.1 | running | | acceptance suite |
| P1.1 | done | `wp/P1.1-revert-formatting` | Modified upstream files 299 → 196 (91 formatting-only reverts, 13 docs restores; +1 `.prettierignore`); 3 stale mode `index.js` deleted. Baseline on `integration/modular-3.11` @ 0132362c0: G1 ok; G2 1843 type errors; G3 216 suites / 1712 tests, all passing. After: same (1843; 216 / 1712). Kept `platform/docs/package.json` + `yarn.lock` (dependabot bump #475). |
| P1.2 | done | #504 | drift guard and ledger; exit check met (script runs and prints the counts). Report vs v3.11.1: 1024 modified upstream files, 58 theme-debt files, 0 ledger rows; 952 unexplained, 14 expected, 57 import violations (all `@ohif/app/src` from upstream files). Awaiting review. |
| P1.3 | done | #506 | Config, build hooks and Docker moved to `pacs-ai/`; 3 ledger rows (webpack.base, webpack.pwa, rsbuild hooks). G1/G3/G4 pass; G2 1848 vs 1857 at branch point in the same container (no new errors). Image `pacs-ai-viewer-migration:p13-b3384e6a7` deployed on the MHI server 2026-11-17 14:45: login, version.json and AI Predictions verified. Build: `docker build -f pacs-ai/docker/Dockerfile.pacs-ai --build-arg APP_BUILD_ID=<id>`; CA certs go in `pacs-ai/docker/ca-certificates/` (git-ignored). |
| P2.1 | done | #507 | `platform/ui` identical to upstream; `@pacs-ai/ui` + `@pacs-ai/theme`. G2 1834 → 1749 (0 new); G3 227 suites / 1814 tests. Image p21-39e12c868 deployed 2026-11-17 15:35: login, settings, members, workspace settings match the 2026-11-15 baseline except intended changes (version text, the F21 toggle, AI Predictions no longer "coming soon"; members times shown in the capture's time zone). Two upstream files with import-only edits (ViewerHeader.tsx, WorkList.tsx) are restored in P2.3/P2.5; no ledger rows added on purpose. |
| P2.2 | running | #508 (draft) | `@pacs-ai/extension-core`: API client, session, providers, update monitor, translations, services `pacsAiSessionService`/`pacsAiModelsService`/`pacsAiStudyContextService`, `ohifCompat/`. `platform/i18n`, `DicomWebDataSource/index.ts`, `initWADOImageLoader.js`, `hooks/index.ts` identical to v3.11.1; `App.tsx` keeps only the tour overlay (P2.3). Bearer header via `userAuthenticationService`; providers via `serviceProvidersManager` (now inside OHIF's providers, around the router); locales via `addLocales`. G1 ok; G2 1749 → 1747 (0 new); G3 235 suites / 1836 tests (was 227 / 1814); G4 image `pacs-ai-viewer-migration:p22-efc6b356e`; G5 unexplained 721 → 520, modified upstream 781 → 580. No ledger rows added. Browser checks (auth, images, French strings) pending. |
