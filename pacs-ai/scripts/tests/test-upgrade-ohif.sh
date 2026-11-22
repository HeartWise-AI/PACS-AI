#!/usr/bin/env bash
# Tests for upgrade-ohif.sh and merge-manifest.py on a tiny synthetic OHIF
# upstream and PACS-AI fork in a temporary directory. The Node steps run with
# --no-docker against a stub pnpm, so only bash, git, python3 and coreutils
# are needed.
# Usage: pacs-ai/scripts/tests/test-upgrade-ohif.sh

set -euo pipefail
export LC_ALL=C

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
UPGRADE="$HERE/../upgrade-ohif.sh"
MERGE="$HERE/../merge-manifest.py"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/upgrade-tests.XXXXXX")
trap '[[ -n ${KEEP_WORK:-} ]] || rm -rf "$WORK"' EXIT

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid
export GIT_AUTHOR_DATE='2026-01-01T00:00:00Z' GIT_COMMITTER_DATE='2026-01-01T00:00:00Z'
unset UPSTREAM_URL

PASS=0 FAIL=0
ok() { PASS=$((PASS + 1)); echo "ok   - $1"; }
not_ok() { FAIL=$((FAIL + 1)); echo "FAIL - $1"; [[ -n ${2:-} ]] && printf '%s\n' "$2" | sed 's/^/       /'; return 0; }
assert_eq() { if [[ $2 == "$3" ]]; then ok "$1"; else not_ok "$1" "expected: $3"$'\n'"actual:   $2"; fi; }
assert_contains() { if grep -qF -- "$3" <<<"$2"; then ok "$1"; else not_ok "$1" "missing: $3"; fi; }
assert_not_contains() { if grep -qF -- "$3" <<<"$2"; then not_ok "$1" "unexpected: $3"; else ok "$1"; fi; }
w() { mkdir -p "$(dirname "$1")"; cat >"$1"; }
json() { python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1]))
for k in sys.argv[2].split("."): d = d[int(k)] if isinstance(d, list) else d.get(k)
print(json.dumps(d))' "$@"; }

# ------------------------------------------------------------ merge-manifest
M="$WORK/mm"
mkdir -p "$M"
echo '{"a":1,"deps":{"x":"1","y":"1"},"list":["p","q"],"plugins":[{"packageName":"A"},{"packageName":"B"}]}' >"$M/base"
echo '{"a":1,"deps":{"x":"1","y":"1","ours":"workspace:*"},"list":["p","q","r"],"plugins":[{"packageName":"OURS"},{"packageName":"B"}]}' >"$M/ours"
echo '{"a":2,"deps":{"x":"2","y":"1","new":"1"},"list":["p","s"],"plugins":[{"packageName":"A"},{"packageName":"B"},{"packageName":"C"}]}' >"$M/theirs"
rc=0; out=$(python3 -I "$MERGE" "$M/base" "$M/ours" "$M/theirs" -o "$M/out") || rc=$?
assert_eq "merge-manifest: clean merge exits 0" "$rc" 0
assert_eq "merge-manifest: result" "$(python3 -I -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1])), separators=(",",":")))' "$M/out")" \
  '{"a":2,"deps":{"x":"2","y":"1","ours":"workspace:*","new":"1"},"list":["p","r","s"],"plugins":[{"packageName":"OURS"},{"packageName":"B"},{"packageName":"C"}]}'
echo '{"a":1,"deps":{"x":"3"}}' >"$M/ours2"
echo '{"a":1,"deps":{"x":"2"}}' >"$M/theirs2"
echo '{"a":1,"deps":{"x":"1"}}' >"$M/base2"
rc=0; out=$(python3 -I "$MERGE" --label pkg "$M/base2" "$M/ours2" "$M/theirs2" -o "$M/out2") || rc=$?
assert_eq "merge-manifest: conflict exits 1" "$rc" 1
assert_contains "merge-manifest: conflict reported" "$out" $'conflict\tpkg: deps.x\tours="3"\tupstream="2" (kept)'
assert_eq "merge-manifest: conflict keeps upstream" "$(cat "$M/out2")" "$(cat "$M/theirs2")"
printf '{\n    "a": 1\n}\n' >"$M/ours3"
rc=0; python3 -I "$MERGE" "$M/base2" "$M/ours3" "$M/base2" -o "$M/out3" >/dev/null || rc=$?
assert_eq "merge-manifest: unchanged upstream keeps our text byte for byte" "$(cat "$M/out3")" "$(cat "$M/ours3")"

# --------------------------------------------------------------- upstream
UP="$WORK/upstream"
git init -q -b master "$UP"
cd "$UP"
pkg() { printf '{\n  "name": "root",\n  "version": "%s",\n  "packageManager": "pnpm@9.0.0",\n  "scripts": {\n    "build": "x"\n  },\n  "devDependencies": {\n    "a": "%s",\n    "b": "1.0.0"%s\n  }\n}\n' "$@"; }
pkg 1.0.0 1.0.0 '' >package.json
w platform/app/package.json <<'EOF'
{
  "name": "app",
  "dependencies": {
    "@ohif/core": "workspace:*"
  }
}
EOF
w platform/app/pluginConfig.json <<'EOF'
{
  "extensions": [
    {
      "packageName": "@ohif/ext-a"
    }
  ],
  "modes": [
    {
      "packageName": "@ohif/mode-longitudinal"
    },
    {
      "packageName": "@ohif/mode-basic"
    }
  ]
}
EOF
echo 'lock v1' >pnpm-lock.yaml
printf 'packages:\n  - extensions/*\noverrides:\n  x: 1\n  y: 1\n' >pnpm-workspace.yaml
echo 'name: ci v1' | w .github/workflows/ci.yml
echo 'name: playwright v1' | w .github/workflows/playwright.yml
echo '24.0.0' >.node-version
for f in a b c d e; do echo "export const $f = 1;" | w "src/$f.js"; done
seq 1 10 | w src/hook.js
echo 'UP=1' | w platform/app/.env
echo 'dist' | w platform/app/.gitignore
git add -A && git commit -q -m v1
git tag v0.9.0 HEAD
echo '# v1.0.0' >>README.md && git add -A && git commit -q -m "v1.0.0" && git tag v1.0.0

# ------------------------------------------------------------------- fork
FORK="$WORK/fork"
git clone -q "$UP" "$FORK"
cd "$FORK"
git checkout -q -b main v1.0.0
echo v1.0.0 | w pacs-ai/UPSTREAM_REF
echo 'export const ours = 1;' | w extensions/pacs-ai-x/index.js
printf '#!/usr/bin/env bash\necho lint-imports stub\n' | w pacs-ai/scripts/lint-imports.sh
chmod +x pacs-ai/scripts/lint-imports.sh
python3 -I - <<'EOF'
import json
p = json.load(open('package.json')); p['scripts']['pacs'] = 'y'; p['devDependencies']['@pacs-ai/x'] = 'workspace:*'
open('package.json', 'w').write(json.dumps(p, indent=2) + '\n')
a = json.load(open('platform/app/package.json')); a['dependencies']['@pacs-ai/x'] = 'workspace:*'
open('platform/app/package.json', 'w').write(json.dumps(a, indent=2) + '\n')
c = json.load(open('platform/app/pluginConfig.json'))
c['extensions'].append({'packageName': '@pacs-ai/x'})
c['modes'][0] = {'packageName': '@pacs-ai/mode-viewer'}
open('platform/app/pluginConfig.json', 'w').write(json.dumps(c, indent=2) + '\n')
EOF
printf '  # PACS-AI\n  moment: 2\n' >>pnpm-workspace.yaml
echo 'lock ours v1' >pnpm-lock.yaml
git mv .github/workflows/playwright.yml .github/workflows/playwright.yml.disabled
sed -i 's/^5$/5 pacs-ai hook/' src/hook.js
echo '.env' >>platform/app/.gitignore
git rm -q --cached platform/app/.env && rm platform/app/.env
git add -A && git commit -q -m "fork"
mkdir -p pacs-ai/patches
git diff --full-index v1.0.0 HEAD -- src/hook.js >pacs-ai/patches/0001-hook.patch
git diff --full-index v1.0.0 HEAD -- platform/app/.env >pacs-ai/patches/0002-env-untracked.patch
git diff --full-index v1.0.0 HEAD -- platform/app/.gitignore >pacs-ai/patches/0003-gitignore.patch
w pacs-ai/UPSTREAM_PATCHES.md <<'EOF'
# Ledger

| File | Feature | Why | Patch file | Upstreamable |
|---|---|---|---|---|
| `src/hook.js` | F1 | test | `0001-hook.patch` | yes |
| `platform/app/.env` | F14 | test | `0002-env-untracked.patch` | no |
| `platform/app/.gitignore` | F14 | test | `0003-gitignore.patch` | no |
EOF
git add -A && git commit -q -m "ledger"
CLEAN_SHA=$(git rev-parse HEAD)
# Unexplained drift (the drift guard would reject it): rules 6, 7 and 8 drop it.
echo 'export const b = 2; // drift' >src/b.js
echo 'export const d = 2; // ours' >src/d.js
git rm -q src/c.js
git add -A && git commit -q -m "drift"
BASE_SHA=$(git rev-parse HEAD)
echo 'SECRET=fork-only' >platform/app/.env

# ------------------------------------------------- upstream v1.1.0, v1.2.0
cd "$UP"
pkg 1.1.0 2.0.0 $',\n    "c": "1.0.0"' >package.json
python3 -I - <<'EOF'
import json
c = json.load(open('platform/app/pluginConfig.json')); c['extensions'].append({'packageName': '@ohif/ext-b'})
open('platform/app/pluginConfig.json', 'w').write(json.dumps(c, indent=2) + '\n')
EOF
echo 'lock v2' >pnpm-lock.yaml
sed -i 's/  x: 1/  x: 2/' pnpm-workspace.yaml
echo 'name: ci v2' >.github/workflows/ci.yml
echo 'name: playwright v2' >.github/workflows/playwright.yml
echo 'export const a = 2;' >src/a.js
echo 'export const c = 2;' >src/c.js
echo 'export const n = 1;' >src/new.js
git rm -q src/d.js src/e.js
sed -i 's/^1$/1 upstream/' src/hook.js
echo 'UP=2' >platform/app/.env
git add -A && git commit -q -m v1.1.0 && git tag v1.1.0
git tag v1.1.0-beta.5 HEAD~0
sed -i 's/^5$/5 upstream rewrote/' src/hook.js
git add -A && git commit -q -m v1.2.0 && git tag v1.2.0
git tag v1.2.0-beta.1 HEAD

# ------------------------------------------------------------ stub pnpm
BIN="$WORK/bin"
w "$BIN/pnpm" <<'EOF'
#!/usr/bin/env bash
echo "pnpm $*" >>"$FAKE_LOG"
case "$*" in *--lockfile-only*) echo 'lock regenerated' >pnpm-lock.yaml ;; esac
if [[ -n ${FAKE_FAIL:-} && "$*" == *"$FAKE_FAIL"* ]]; then echo "fake failure of: $*"; exit 1; fi
echo "Test Suites: 1 passed, 1 total"
EOF
chmod +x "$BIN/pnpm"
export PATH="$BIN:$PATH" FAKE_LOG="$WORK/pnpm.log"

cd "$FORK"
reset_fork() {
  git merge --abort 2>/dev/null || true
  git reset -q --hard
  git switch -q main
  git reset -q --hard "${1:-$BASE_SHA}"
  git clean -qfd
  git for-each-ref --format='%(refname:short)' refs/heads/upgrade/ | xargs -r git branch -q -D
  echo 'SECRET=fork-only' >platform/app/.env
  : >"$FAKE_LOG"
}
run() { # run LABEL args...: sets RC and OUT
  local label=$1; shift
  RC=0
  OUT=$("$UPGRADE" --repo "$FORK" --upstream-url "$UP" --no-docker --log-dir "$WORK/logs/$label" "$@" 2>&1) || RC=$?
}

# 1. No-op: the pinned tag itself.
reset_fork "$CLEAN_SHA"
run noop --no-checks v1.0.0
assert_eq "no-op: exit 0" "$RC" 0
assert_contains "no-op: nothing committed" "$OUT" "nothing to commit"
assert_eq "no-op: branch at base" "$(git rev-parse HEAD)" "$CLEAN_SHA"
assert_eq "no-op: on the upgrade branch" "$(git symbolic-ref --short HEAD)" upgrade/v1.0.0
assert_eq "no-op: .env kept" "$(cat platform/app/.env)" "SECRET=fork-only"
assert_eq "no-op: working tree clean" "$(git status --porcelain)" ""
reset_fork "$CLEAN_SHA"
run noopchecks v1.0.0
assert_eq "no-op with checks: exit 0" "$RC" 0
assert_contains "no-op with checks: drift guard passes" "$OUT" "drift          pass"
assert_not_contains "no-op with checks: lock kept" "$(cat "$FAKE_LOG")" "--lockfile-only"
reset_fork
run drift --no-checks v1.0.0
assert_contains "same tag, with drift: rules drop the drift" "$(git log -1 --format=%s)" "Re-apply"
assert_eq "same tag, with drift: single-parent commit" "$(git rev-list --parents -n 1 HEAD | wc -w)" 2
assert_eq "same tag, with drift: drift gone" "$(git diff --name-only "$CLEAN_SHA" HEAD | tr '\n' ' ')" ""

# 2. Upgrade with checks (stub pnpm).
reset_fork
run v11 v1.1.0
assert_eq "upgrade: exit 0" "$RC" 0
assert_eq "upgrade: two-parent merge commit" "$(git rev-list --parents -n 1 HEAD | wc -w)" 3
assert_eq "upgrade: second parent is the tag" "$(git rev-parse HEAD^2)" "$(git rev-parse 'refs/upstream/v1.1.0^{commit}')"
assert_eq "upgrade: UPSTREAM_REF" "$(cat pacs-ai/UPSTREAM_REF)" v1.1.0
assert_eq "rule 8: upstream change taken" "$(cat src/a.js)" "export const a = 2;"
assert_eq "rule 8: our unexplained edit dropped" "$(cat src/b.js)" "export const b = 1;"
assert_contains "rule 8: loss reported" "$OUT" "src/b.js"
assert_eq "rule 6: file we deleted comes back as upstream's" "$(cat src/c.js)" "export const c = 2;"
assert_eq "rule 7: file upstream deleted is deleted" "$(git ls-files src/d.js src/e.js)" ""
assert_eq "upstream addition taken" "$(git ls-files src/new.js)" src/new.js
assert_eq "rule 2: patch on upstream's new file" "$(sed -n '1p;5p' src/hook.js | tr '\n' '|')" "1 upstream|5 pacs-ai hook|"
assert_contains "rule 2: patch refreshed against the tag" "$(cat pacs-ai/patches/0001-hook.patch)" "index $(git rev-parse refs/upstream/v1.1.0:src/hook.js).."
assert_eq "rule 2: .env untracked" "$(git ls-files platform/app/.env)" ""
assert_contains "rule 2: untrack patch regenerated" "$(cat pacs-ai/patches/0002-env-untracked.patch)" "-UP=2"
assert_eq ".env restored" "$(cat platform/app/.env)" "SECRET=fork-only"
assert_eq ".env never committed" "$(git log --all -p | grep -c 'SECRET=fork-only' || true)" 0
assert_eq "rule 4: upstream bump" "$(json package.json devDependencies.a)" '"2.0.0"'
assert_eq "rule 4: upstream addition" "$(json package.json devDependencies.c)" '"1.0.0"'
assert_eq "rule 4: our dependency re-added" "$(json package.json devDependencies.@pacs-ai/x)" '"workspace:*"'
assert_eq "rule 4: our script re-added" "$(json package.json scripts.pacs)" '"y"'
assert_eq "rule 4: app dependency re-added" "$(json platform/app/package.json dependencies.@pacs-ai/x)" '"workspace:*"'
assert_eq "rule 4: our mode replaces longitudinal" "$(json platform/app/pluginConfig.json modes.0.packageName)" '"@pacs-ai/mode-viewer"'
assert_eq "rule 4: upstream and our extensions" \
  "$(python3 -I -c 'import json; print(",".join(e["packageName"] for e in json.load(open("platform/app/pluginConfig.json"))["extensions"]))')" \
  "@ohif/ext-a,@pacs-ai/x,@ohif/ext-b"
assert_eq "expected: pnpm-workspace three-way" "$(cat pnpm-workspace.yaml)" $'packages:\n  - extensions/*\noverrides:\n  x: 2\n  y: 1\n  # PACS-AI\n  moment: 2'
assert_eq "expected: workflow taken" "$(cat .github/workflows/ci.yml)" "name: ci v2"
assert_eq "expected: disabled workflow stays disabled" "$(git ls-files .github/workflows/playwright.yml)" ""
assert_eq "expected: disabled workflow refreshed" "$(cat .github/workflows/playwright.yml.disabled)" "name: playwright v2"
assert_eq "rule 5: lock regenerated" "$(git show HEAD:pnpm-lock.yaml)" "lock regenerated"
assert_eq "ours kept" "$(cat extensions/pacs-ai-x/index.js)" "export const ours = 1;"
PLOG=$(cat "$FAKE_LOG")
assert_contains "checks: lockfile regeneration" "$PLOG" "pnpm install --lockfile-only --no-frozen-lockfile"
assert_contains "checks: frozen install" "$PLOG" "pnpm install --frozen-lockfile"
assert_contains "checks: build" "$PLOG" "pnpm run build"
assert_contains "checks: unit tests" "$PLOG" "pnpm -r --no-bail --no-sort run test:unit:ci"
assert_contains "checks: drift guard passes" "$OUT" "drift          pass"
assert_contains "checks: fresh patches pass" "$OUT" "patches-fresh  pass"
assert_contains "checks: lint-imports ran" "$(cat "$WORK/logs/v11/lint-imports.log")" "lint-imports stub"
assert_eq "summary.md written" "$(grep -c '^| install | pass' "$WORK/logs/v11/summary.md")" 1
assert_eq "working tree clean after upgrade" "$(git status --porcelain)" ""
: >"$FAKE_LOG"
RC=0; OUT=$("$UPGRADE" --repo "$FORK" --no-docker --checks-only --log-dir "$WORK/logs/checksonly" 2>&1) || RC=$?
assert_eq "--checks-only: exit 0" "$RC" 0
assert_contains "--checks-only: header" "$OUT" "upgrade-ohif --checks-only: upgrade/v1.1.0"
assert_contains "--checks-only: tag from UPSTREAM_REF" "$OUT" "UPSTREAM_REF v1.1.0"
assert_contains "--checks-only: runs the checks" "$(cat "$FAKE_LOG")" "pnpm run build"
RC=0; OUT=$(FAKE_FAIL=test:unit "$UPGRADE" --repo "$FORK" --no-docker --checks-only --log-dir "$WORK/logs/checksonly2" 2>&1) || RC=$?
assert_eq "--checks-only: failing tests exit 1" "$RC" 1
assert_contains "--checks-only: failing tests reported" "$OUT" "unit-tests     FAIL"

# 3. Dry run: staged, not committed.
reset_fork
run dry --dry-run --no-checks v1.1.0
assert_eq "dry run: exit 1 (lock not regenerated with --no-checks)" "$RC" 1
assert_eq "dry run: no commit" "$(git rev-parse HEAD)" "$BASE_SHA"
assert_eq "dry run: merge in progress" "$(git rev-parse -q --verify MERGE_HEAD >/dev/null && echo yes)" yes
assert_eq "dry run: UPSTREAM_REF staged" "$(git show :pacs-ai/UPSTREAM_REF)" v1.1.0
assert_eq "dry run: .env restored" "$(cat platform/app/.env)" "SECRET=fork-only"
reset_fork
run dry2 --dry-run v1.1.0
assert_eq "dry run with checks: exit 0" "$RC" 0
assert_eq "dry run with checks: no commit" "$(git rev-parse HEAD)" "$BASE_SHA"

# 4. A patch that no longer applies: stop before the commit.
reset_fork
run conflict --no-checks v1.2.0
assert_eq "patch conflict: exit 1" "$RC" 1
assert_contains "patch conflict: reported" "$OUT" "0001-hook.patch does not apply to v1.2.0"
assert_eq "patch conflict: not committed" "$(git rev-parse HEAD)" "$BASE_SHA"
assert_contains "patch conflict: markers left" "$(cat src/hook.js)" "<<<<<<<"
assert_eq "patch conflict: file left unmerged" "$(git ls-files -u -- src/hook.js | wc -l)" 3
assert_eq "patch conflict: .env restored" "$(cat platform/app/.env)" "SECRET=fork-only"

# 5. Same with --keep-going: committed, file left at upstream's version.
reset_fork
run keepgoing --keep-going v1.2.0
assert_eq "keep-going: exit 1" "$RC" 1
assert_eq "keep-going: committed" "$(git rev-list --parents -n 1 HEAD | wc -w)" 3
assert_eq "keep-going: file at upstream's version" "$(sed -n 5p src/hook.js)" "5 upstream rewrote"
assert_contains "keep-going: listed for a person" "$OUT" "src/hook.js left at upstream's version"
assert_contains "keep-going: checks still run" "$(cat "$FAKE_LOG")" "test:unit:ci"

# 6. Failing check: stop after it unless --keep-going.
reset_fork
FAKE_FAIL="run build" run buildfail v1.1.0
assert_eq "failing build: exit 1" "$RC" 1
assert_contains "failing build: reported" "$OUT" "build          FAIL"
assert_contains "failing build: later checks skipped" "$OUT" "unit-tests     skipped (stopped after a failure)"
assert_eq "failing build: merge still committed" "$(git rev-list --parents -n 1 HEAD | wc -w)" 3
reset_fork
FAKE_FAIL="run build" run buildfail2 --keep-going v1.1.0
assert_contains "failing build, keep-going: tests run" "$(cat "$FAKE_LOG")" "test:unit:ci"
reset_fork
run nobuild --no-build v1.1.0
assert_contains "--no-build" "$OUT" "build          skipped (--no-build)"

# 7. Tag resolution, refusals.
reset_fork
run latest --dry-run --no-checks latest
assert_contains "latest: final release after its betas" "$OUT" "-> v1.2.0"
reset_fork
run latestprefix --dry-run --no-checks latest:v1.1
assert_contains "latest:<prefix>" "$OUT" "-> v1.1.0"
reset_fork
run older --no-checks v0.9.0
assert_eq "older tag refused" "$RC" 2
reset_fork
echo dirty >>src/a.js
run dirty --no-checks v1.1.0
assert_eq "dirty tree refused" "$RC" 2
reset_fork
run outside --log-dir "$FORK/logs" --no-checks v1.1.0
assert_eq "log dir inside the repository refused" "$RC" 2

echo
echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
