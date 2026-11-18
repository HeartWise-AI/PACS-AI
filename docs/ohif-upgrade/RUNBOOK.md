# OHIF upgrade runbook

The yearly move of PACS-AI to a new OHIF release. Background: `PLAN.md`
(sections 6 and 9), the 3.11 → 3.13 record in `STATUS.md`, and the next step
in `NEXT-3.14.md`. Every command runs from the repository root.

## 0. Before you start

- [ ] Pick the pin: the newest **stable** tag of the target line (not a beta).
      The weekly canary (`pacs-ai-upstream-canary.yml`) shows how far the
      newest tag is from merging cleanly; read its last summary first.
- [ ] Docker and a git identity on the machine. The Node steps run in
      `node:<upstream .node-version>-slim` with the pnpm of upstream's
      `packageManager`; Node is not needed on the host (`--no-docker` uses the
      host's Node and pnpm instead).
- [ ] **Back up `platform/app/.env`** (the deployment's build environment,
      untracked, ledger row 0006). Git overwrites an ignored file when a merge
      or checkout brings a tracked file at that path; the 3.13 merge did.
      `upgrade-ohif.sh` moves it aside and puts it back, but any manual
      `git merge`, `git checkout <upstream ref>` or `git stash -u` can still
      destroy it: `cp -p platform/app/.env ~/pacs-ai-env.backup && chmod 600 ~/pacs-ai-env.backup`.
      Never commit it, never print it.
- [ ] Record the decision (target, date) in `STATUS.md`.

## 1. Read upstream's migration guide

- [ ] `git fetch --no-tags https://github.com/OHIF/Viewers.git +refs/tags/<tag>:refs/upstream/<tag>`
- [ ] Read `platform/docs/docs/migration-guide/<from>-to-<to>/` at the tag
      (`git show refs/upstream/<tag>:platform/docs/docs/migration-guide/...`)
      and the release notes.
- [ ] Grep our packages (`extensions/pacs-ai-*`, `modes/pacs-ai`,
      `pacs-ai/config`, `pacs-ai/build`) for every symbol the guide changes;
      write the hits as a numbered work list in `STATUS.md` (the 3.13 list is
      the model: area, what breaks, our files).

## 2. Run the script

```bash
# a first look, in a throwaway clone: every problem at once
git clone --no-checkout <this repository> /tmp/ohif-look && cd /tmp/ohif-look
git checkout integration/ohif-<current> && pacs-ai/scripts/upgrade-ohif.sh --keep-going <tag>
# (from a shallow local repository: git clone --shared --no-checkout <its .git>
#  and copy its .git/shallow into the clone, or the clone misses objects)

# the real run, from the integration head
git switch integration/ohif-<current>
pacs-ai/scripts/upgrade-ohif.sh <tag>
```

It creates `upgrade/<tag>`, merges `refs/upstream/<tag>` with the P3.1 rules,
commits a two-parent merge, updates `pacs-ai/UPSTREAM_REF`, then runs: ledger
patches on a fresh tag, drift guard, `pnpm install --frozen-lockfile`, build,
`lint-imports.sh`, unit tests. The summary (also `summary.txt`/`summary.md`
in the log directory it prints) lists conflicts by rule, patch results, the
items that need a person and each check. `--help` lists the options
(`--dry-run`, `--no-build`, `--typecheck`, `--base`, `--checks-only`).

The rules it applies (PLAN 9, P3.1), with P = pinned tag, O = our branch,
T = new tag:

| Rule | Paths | Result |
|---|---|---|
| 1 | "ours" (PLAN 6.1) | O |
| 2 | ledger files (`pacs-ai/UPSTREAM_PATCHES.md`) | T + `apply-patches.sh`; patches refreshed against T; an "untrack" patch (0006 `.env`) is regenerated |
| 3 | `pacs-ai/THEME_DEBT.txt` (if it exists again) | T |
| 4 | root and app `package.json`, `pluginConfig.json` | T + our entries (`merge-manifest.py`, three-way against P) |
| 5 | lock files | `pnpm-lock.yaml` regenerated from T's (kept when nothing changed); `yarn.lock`/`bun.lock` deleted |
| – | expected files (`pnpm-workspace.yaml`, upstream workflows, `version.*`) | three-way `git merge-file`; a workflow we disabled stays disabled, its `.disabled` copy gets T's file |
| 6 | upstream file we deleted | T |
| 7 | upstream file we changed and upstream deleted | deleted |
| 8 | everything else upstream-owned | T; our edits it drops are listed (should be none: the drift guard forbids them) |

When it stops (exit 1):

- **Before the commit** (a patch or a three-way merge conflicts, a manifest
  key both sides changed): the merge is staged on `upgrade/<tag>`. Fix each
  item of "needs a person", `git add`, then `git commit` (git keeps
  `MERGE_HEAD`, so the commit has two parents), then
  `pacs-ai/scripts/upgrade-ohif.sh --checks-only`.
- **A patch no longer applies:** regenerate it against the tag
  (`pacs-ai/patches/README.md`); check `apply-patches.sh --fresh --check`.
  Retire the row if the release makes it unnecessary ("already in <tag>" in
  the summary, or a new extension point). The ledger stays at 15 rows or fewer.
- **Manifest conflicts:** both sides changed a key (often a dependency we
  pinned and upstream bumped). Upstream's value is in the file; keep it unless
  our package needs ours, then say why in `STATUS.md`.
- **After the commit** (install, build, lint, tests red): that is the work of
  steps 3 and 4. Re-run the gates with `--checks-only` after each fix.

## 3. Fix our packages

- [ ] `extensions/pacs-ai-core/src/ohifCompat/` first (PLAN 6.4): the only
      place our code touches OHIF APIs known to change. Then the packages, one
      branch per package (core, shell, inference, chat + ui, mode), each with
      its own gates: type check of the package's own files (count must not
      rise), its unit tests.
- [ ] Temporary swaps (`STATUS.md`, "Temporary swaps"): re-check each against
      the new release; drop those it makes unnecessary.
- [ ] New third-party dependencies: declared by the package that imports them
      (rule 4 of PLAN 6.2), with their peer ranges checked against upstream's
      React.

## 4. Theme check

- [ ] `pnpm --filter @pacs-ai/theme run test:unit:ci`.
      `upstreamAnchors.test.ts` fails when upstream removed a class string that
      a rule of `extensions/pacs-ai-theme/src/styles/pacs-ai-theme.css` matches
      (each such rule carries an `@upstream <file> :: <text>` anchor): update
      the rule and its anchor to the new markup.
- [ ] Compare upstream's dark preset (`platform/ui-next/src/themes/`) with
      `pacsAiTheme.ts`: every new token needs a value.
- [ ] `visual.spec.ts` against the phase 0 baseline (step 6).

## 5. Build the image

- [ ] Update `pacs-ai/docker/Dockerfile.pacs-ai` to upstream's root
      `Dockerfile` at the tag (Node image, pnpm version), keeping the CA hook and
      our build args.
- [ ] `docker build -f pacs-ai/docker/Dockerfile.pacs-ai --build-arg APP_BUILD_ID=<id> -t pacs-ai-viewer-migration:<id> .`
      (needs `platform/app/.env`; optional CA certificates in
      `pacs-ai/docker/ca-certificates/`, git-ignored).
- [ ] Container smoke: `/`, `/login`, `/viewer?StudyInstanceUIDs=x`, an
      unknown path, `/version.json` (buildId), `/app-config.js`,
      `/env-config.js`, `/sw.js` answer 200.

## 6. Acceptance suite

- [ ] Run `tests/pacs-ai` against the image deployed on the test server
      (workflow `pacs-ai-acceptance.yml`, or Playwright in Docker with the same
      environment variables). All specs pass; known data-dependent failures are
      listed in `STATUS.md`.
- [ ] **AI reference runs.** `run-model.spec.ts` compares every model's run
      with references recorded by the previous production build. If the
      reference studies changed since they were recorded (images are deleted
      about 24 h after arrival and re-retrieved series can differ), re-record
      them **before** deploying the new build:
      1. serve the current production build's static files to the test browser
         (Playwright `page.route` answering the app's own URLs from the
         unpacked production image; API requests go to the live server);
      2. on each reference study, for each model, do the spec's clicks (Rerun or
         Apply → "Select first N series" → Apply) and wait for the result;
      3. save, in the layout of `tests/pacs-ai/support/golden.ts`:
         `golden/<study>__<model key>.txt` and `.png`, `golden/index.json`,
         `ai-runs/<study>__<model key>.net.json` (the request and the status
         responses) and `ai-runs/summary.json`;
      4. keep them in the host folder that `PACS_AI_E2E_GOLDEN_DIR` (and
         `PACS_AI_E2E_BASELINE_DIR` for screenshots) point to. They contain
         patient data: never in the repository, a PR or a workflow artifact.
      Compare the series of a run as a set, and "first N" runs against the
      series-number order (3.11 sent them in network order, STATUS P3.3).
- [ ] Rendering checks of P3.5 on real studies (XA/US cine and autoplay,
      multi-frame XA through the proxy, measurements, encapsulated PDF, stored
      AI results, segmentation import, thumbnails, load time).

## 7. Staging

- [ ] Open the PR `upgrade/<tag>` → integration branch (draft), with the
      summary, the ledger changes and the gates.
- [ ] Deploy the image to staging (staging release PR, workflow
      `pacs-ai-staging-release-validation.yml`) and repeat the smoke checks
      and the viewer specs there.

## 8. Production

Only with the owner's go-ahead, at an idle moment.

- [ ] Note the image tag running now: it is the rollback image. Do not delete
      it.
- [ ] Point the deployment at the new image, start it, then check: login,
      `/version.json` buildId, open a reference study (images, cine, study
      browser badges), AI results of a stored run, chat.
- [ ] Rollback: point the deployment back at the previous image tag and
      restart; check login again.
- [ ] Never touch the model gateway, the study service or the ingestion jobs
      as part of the viewer upgrade.

## 9. Close

- [ ] `STATUS.md`: numbers (modified upstream files, ledger rows, type errors,
      unit tests), accepted behaviour changes, what was lost under rule 8.
- [ ] `pacs-ai/UPSTREAM_PATCHES.md`: a "Re-applied on <tag>" note (which
      patches were regenerated or retired).
- [ ] `docs/ohif-upgrade/README.md` numbers; a `NEXT-<version>.md` for the
      following release from a `--keep-going` run on its newest tag.

## Rules that hold all year (PLAN 6.2)

1. **Import direction.** Nothing upstream-owned imports from an "ours" path or
   `@ohif/app/src`; our packages never import `@ohif/app/src`, `@ohif/ui`, or
   another package by relative path. Enforced by `lint-imports.sh` and the drift
   guard.
2. **Drift guard.** `pacs-ai/scripts/check-upstream-drift.sh --enforce
   --forbid-ohif-ui`: every upstream-owned file that differs from
   `refs/upstream/$(cat pacs-ai/UPSTREAM_REF)` is a ledger file or an expected
   generated file; nothing else. CI: `pacs-ai-drift.yml`.
3. **Ledger.** Each kept edit of an upstream file has a row in
   `pacs-ai/UPSTREAM_PATCHES.md` and a patch under `pacs-ai/patches/`
   (`apply-patches.sh`); at most 15 rows.
4. **Manifests declare every dependency they import** (pnpm resolves nothing
   undeclared).
