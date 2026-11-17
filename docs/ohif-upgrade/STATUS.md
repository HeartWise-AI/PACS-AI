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
| P1.1 | running | | formatting-only reverts |
| P1.2 | running | #504 (draft) | drift guard and ledger; exit check met (script runs and prints the counts). Report vs v3.11.1: 1024 modified upstream files, 58 theme-debt files, 0 ledger rows; 952 unexplained, 14 expected, 57 import violations (all `@ohif/app/src` from upstream files). Awaiting review. |
| P1.3 | todo | | after P1.1 (touches config/Docker files) |
