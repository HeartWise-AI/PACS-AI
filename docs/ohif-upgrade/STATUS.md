# OHIF upgrade status

Plan: `docs/ohif-upgrade/PLAN.md`. One line per work package. States: todo, running, done, blocked.

## Decisions (P0.2)

| # | Decision | Value | Source |
|---|---|---|---|
| D1 | Target | OHIF 3.13.14 (`e4cd86153`); still the newest stable 3.13 tag on 2026-11-17 | user |
| D2 | Modularize before the upgrade | yes (phases 1–2 on 3.11.1) | plan default |
| D3 | Stock features the fork dropped | flags off in `pacs-ai.js`; investigational-use dialog stays hidden (possible regulatory question, raised to the user once) | plan default, awaiting user |
| D4 | Work list | ours, as a custom route | plan default |
| D5 | Upstream theme dialog | hidden | plan default |
| D6 | `useNextViewports` | off | plan default |
| D7 | Orchestrator | **Claude Opus 5.5** from 2026-11-17 (user: "start it with opus"); the plan was written with Fable 5.2, which is rate-limited until 2026-11-22 | user |

## Work packages

| WP | State | PR / commit | Notes |
|---|---|---|---|
| P1.4 | done | `integration/modular-3.11` @ c814f5ea1 | Tree identical to `origin/main` 374c64929 before the `UPSTREAM_REF` commit; merge-base with v3.13.14 = 974ef29aa. Needed `--allow-unrelated-histories` (add to the plan's command). |
| P0.2 | done | this file | |
| P0.1 | running | | acceptance suite |
| P1.1 | done (draft PR, awaiting review) | `wp/P1.1-revert-formatting` | Modified upstream files 299 → 196 (91 formatting-only reverts, 13 docs restores; +1 `.prettierignore`); 3 stale mode `index.js` deleted. Baseline on `integration/modular-3.11` @ 0132362c0: G1 ok; G2 1843 type errors; G3 216 suites / 1712 tests, all passing. After: same (1843; 216 / 1712). Kept `platform/docs/package.json` + `yarn.lock` (dependabot bump #475). |
| P1.2 | running | | drift guard and ledger |
| P1.3 | todo | | after P1.1 (touches config/Docker files) |
