#!/usr/bin/env bash
# Tests for check-upstream-drift.sh and apply-patches.sh.
# Builds a tiny synthetic upstream + fork in a temporary directory.
# Usage: pacs-ai/scripts/tests/run-tests.sh   (bash, git, coreutils only)

set -euo pipefail
export LC_ALL=C

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DRIFT="$HERE/../check-upstream-drift.sh"
APPLY="$HERE/../apply-patches.sh"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/drift-tests.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

# Isolate git from the user's configuration.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid
export GIT_AUTHOR_DATE='2026-01-01T00:00:00Z' GIT_COMMITTER_DATE='2026-01-01T00:00:00Z'
unset UPSTREAM_URL

PASS=0 FAIL=0
ok() { PASS=$((PASS + 1)); echo "ok   - $1"; }
not_ok() { FAIL=$((FAIL + 1)); echo "FAIL - $1"; [[ -n ${2:-} ]] && printf '%s\n' "$2" | sed 's/^/       /'; }
assert_eq() { if [[ $2 == "$3" ]]; then ok "$1"; else not_ok "$1" "expected: $3"$'\n'"actual:   $2"; fi; }
assert_contains() { if grep -qF -- "$3" <<<"$2"; then ok "$1"; else not_ok "$1" "missing: $3"; fi; }
assert_not_contains() { if grep -qF -- "$3" <<<"$2"; then not_ok "$1" "unexpected: $3"; else ok "$1"; fi; }
count_of() { sed -nE "s/^$2:[[:space:]]+([0-9]+).*/\\1/p" <<<"$1"; }
w() { mkdir -p "$(dirname "$1")"; cat >"$1"; }

# --------------------------------------------------------------- upstream repo
UP="$WORK/upstream"
git init -q -b main "$UP"
cd "$UP"
w src/theme.tsx <<'EOF'
export const Box = () => (
  <div className="bg-muted text-aqua-pale mb-0.5 px-1.5">
    <span style={{ color: '#348CFD' }}>Hi</span>
  </div>
);
EOF
w src/vars.css <<'EOF'
:root {
  --primary: 214 98% 60%;
  --muted: 234 64% 10%;
}
.a {
  @apply border-secondary-light bg-black text-white;
  background-color: rgba(9, 68, 179, 0.5);
}
EOF
w src/wrapped.tsx <<'EOF'
const cls = cn('text-muted-foreground', active && 'bg-primary/10');
EOF
w src/logic.ts <<'EOF'
export const x = 1;
EOF
w src/space.ts <<'EOF'
export const y = 2;
EOF
w src/quotes.ts <<'EOF'
import { Toggle } from "./Toggle";
EOF
w src/mixed.css <<'EOF'
.b {
  @apply bg-black;
  min-height: 28px;
}
EOF
w src/label.tsx <<'EOF'
<Label className="text-xs">Opacity</Label>
EOF
w src/patched.ts <<'EOF'
export const z = 3;
EOF
w src/importer.ts <<'EOF'
import a from './a';
EOF
w src/legacy.ts <<'EOF'
import old from '@ohif/app/src/old';
EOF
printf 'binary\000one' >src/blob.bin
w yarn.lock <<'EOF'
# lock v1
EOF
w README.md <<'EOF'
upstream
EOF
git add -A && git commit -q -m upstream
git tag -a v1.0.0 -m v1.0.0

# ------------------------------------------------------------------ fork repo
FORK="$WORK/fork"
git clone -q --no-tags "$UP" "$FORK"
cd "$FORK"
git update-ref refs/upstream/v1.0.0 "$(git -C "$UP" rev-parse refs/tags/v1.0.0)"

# Commit 1 ("clean"): only theme debt, a ledger patch and an expected file.
mkdir -p pacs-ai/patches pacs-ai/scripts
echo v1.0.0 >pacs-ai/UPSTREAM_REF
w src/theme.tsx <<'EOF'
export const Box = () => (
  // NOTE: This is a PACS changes
  <div className="mb-0.5 px-1.5 bg-white/10 text-white">
    <span style={{ color: '#c8f469' }}>Hi</span> {/* NOTE: This is a PACS changes */}
  </div>
);
EOF
w src/vars.css <<'EOF'
:root {
  --primary: 79 86% 68%; /* ui primary #c8f469 */
  --muted: 234 32% 10%;
}
.a {
  @apply w-full rounded-xl bg-white bg-opacity-10;
  background-color: #c8f469;
}
EOF
w src/wrapped.tsx <<'EOF'
const cls = cn(
  'text-white hover:!text-primary-light',
  active && 'bg-white/10'
);
EOF
echo 'export const z = 4;' >src/patched.ts
echo '# lock v2' >yarn.lock
git diff --full-index HEAD -- src/patched.ts >pacs-ai/patches/0001-patched.patch
w pacs-ai/UPSTREAM_PATCHES.md <<'EOF'
# Ledger

| File | Feature | Why no extension point works | Extension point considered | Patch file | Upstreamable | Owner / WP |
|---|---|---|---|---|---|---|
| `src/patched.ts` | F1 | test | none | `0001-patched.patch` | no | P1.2 |
EOF
git add -A && git commit -q -m clean
CLEAN=$(git rev-parse HEAD)

# Commit 2: everything else.
echo 'export const x = 2;' >src/logic.ts
echo 'export  const y = 2;  ' >src/space.ts
echo "import { Toggle } from './Toggle';" >src/quotes.ts
w src/mixed.css <<'EOF'
.b {
  @apply bg-white;
  min-height: 51px;
}
EOF
echo '<Label className="text-xs">Opaque</Label>' >src/label.tsx
w src/importer.ts <<'EOF'
import a from './a';
import core from '@pacs-ai/core';
import { useAppConfig } from '@ohif/app/src/state';
const later = require('../extensions/pacs-ai-ui/src/thing');
EOF
w src/new.ts <<'EOF'
export const added = true;
EOF
printf 'binary\000two' >src/blob.bin
w extensions/pacs-ai-core/src/a.ts <<'EOF'
import local from './local';
import idx from '../index';
import sib from '../../pacs-ai-ui/src/x';
import { Button } from '@ohif/ui';
import next from '@ohif/ui-next';
EOF
w modes/pacs-ai/src/m.ts <<'EOF'
export { x } from '@ohif/app/src/x';
EOF
w .github/CODEOWNERS <<'EOF'
* @nobody
EOF
git add -A && git commit -q -m fork

# Theme-debt classification without pacs-ai/THEME_DEBT.txt (the pre-P3.4
# rule) is tested with --allow-theme-heuristic; the default is checked below.
DRIFT_ARGS=(--repo "$FORK" --allow-theme-heuristic)

echo "# check-upstream-drift.sh: report"
out=$("$DRIFT" "${DRIFT_ARGS[@]}" --report); rc=$?
assert_eq "report exits 0" "$rc" 0
assert_eq "modified upstream files" "$(count_of "$out" 'modified upstream files')" 13
assert_eq "theme-debt files" "$(count_of "$out" 'theme-debt files')" 3
assert_eq "ledger rows" "$(count_of "$out" 'ledger rows')" 1
assert_eq "unexplained files" "$(count_of "$out" 'unexplained files')" 8
assert_eq "ledger-patched files" "$(count_of "$out" 'ledger-patched files')" 1
assert_eq "expected files" "$(count_of "$out" 'expected \(generated\) files')" 1
assert_eq "import violations" "$(count_of "$out" 'import-direction violations')" 5

theme=$(sed -n '/^Theme-debt files/,/^$/p' <<<"$out")
for f in src/theme.tsx src/vars.css src/wrapped.tsx; do
  assert_contains "theme debt: $f" "$theme" "$f"
done
unexp=$(sed -n '/^Unexplained files/,/^$/p' <<<"$out")
for f in src/logic.ts src/space.ts src/quotes.ts src/mixed.css src/label.tsx src/importer.ts \
         src/new.ts src/blob.bin; do
  assert_contains "unexplained: $f" "$unexp" "$f"
done
assert_contains "added file keeps status A" "$unexp" $'A\tsrc/new.ts'
assert_not_contains "ours path not listed (pacs-ai/)" "$out" "pacs-ai/UPSTREAM_REF"
assert_not_contains "ours path not listed (CODEOWNERS)" "$out" ".github/CODEOWNERS"
assert_contains "ledger file classified" "$(sed -n '/^Ledger-patched files/,/^$/p' <<<"$out")" "src/patched.ts"
assert_contains "lock file is expected" "$(sed -n '/^Expected files/,/^$/p' <<<"$out")" "yarn.lock"

viol=$(sed -n '/^Import-direction violations/,/^$/p' <<<"$out")
assert_contains "upstream imports @pacs-ai" "$viol" $'upstream-imports-ours\tsrc/importer.ts\t@pacs-ai/core'
assert_contains "upstream requires ours path" "$viol" $'upstream-imports-ours\tsrc/importer.ts\t../extensions/pacs-ai-ui/src/thing'
assert_contains "upstream imports @ohif/app/src" "$viol" $'upstream-imports-app-src\tsrc/importer.ts\t@ohif/app/src/state'
assert_contains "ours imports @ohif/app/src" "$viol" $'ours-imports-app-src\tmodes/pacs-ai/src/m.ts\t@ohif/app/src/x'
assert_contains "ours relative import across packages" "$viol" $'ours-relative-cross-pkg\textensions/pacs-ai-core/src/a.ts\t../../pacs-ai-ui/src/x'
assert_not_contains "relative import inside package allowed" "$viol" "../index"
assert_not_contains "pre-existing upstream import not flagged" "$viol" "src/legacy.ts"
assert_not_contains "@ohif/ui allowed without --forbid-ohif-ui" "$viol" "ours-imports-ohif-ui"

out=$("$DRIFT" "${DRIFT_ARGS[@]}" --report --forbid-ohif-ui)
viol=$(sed -n '/^Import-direction violations/,/^$/p' <<<"$out")
assert_contains "--forbid-ohif-ui flags @ohif/ui" "$viol" $'ours-imports-ohif-ui\textensions/pacs-ai-core/src/a.ts\t@ohif/ui'
assert_not_contains "--forbid-ohif-ui leaves @ohif/ui-next alone" "$viol" "@ohif/ui-next"

out2=$("$DRIFT" "${DRIFT_ARGS[@]}" --report)
assert_eq "output is deterministic" "$out2" "$("$DRIFT" "${DRIFT_ARGS[@]}" --report)"

echo "# check-upstream-drift.sh: enforce"
set +e
"$DRIFT" "${DRIFT_ARGS[@]}" --enforce >/dev/null 2>&1; rc=$?
set -e
assert_eq "enforce fails on unexplained drift" "$rc" 1
set +e
out=$("$DRIFT" "${DRIFT_ARGS[@]}" --enforce --rev "$CLEAN" 2>&1); rc=$?
set -e
assert_eq "enforce passes on clean commit (--rev)" "$rc" 0
assert_eq "clean commit: unexplained 0" "$(count_of "$out" 'unexplained files')" 0
assert_eq "clean commit: theme 3" "$(count_of "$out" 'theme-debt files')" 3

echo "# check-upstream-drift.sh: theme debt retired (no list, default)"
set +e
out=$("$DRIFT" --repo "$FORK" --enforce --rev "$CLEAN" 2>&1); rc=$?
set -e
assert_eq "enforce fails on theme-like files without the list" "$rc" 1
assert_eq "retired: theme 0" "$(count_of "$out" 'theme-debt files')" 0
assert_eq "retired: unexplained 3" "$(count_of "$out" 'unexplained files')" 3
retired=$(sed -n '/^Theme-like files/,/^$/p' <<<"$out")
for f in src/theme.tsx src/vars.css src/wrapped.tsx; do
  assert_contains "retired: theme-like $f named" "$retired" "$f"
done

# Ledger over the limit and a missing patch file (working tree only).
{
  cat pacs-ai/UPSTREAM_PATCHES.md
  for i in $(seq 1 15); do echo "| \`src/f$i.ts\` | F1 | t | none | \`missing-$i.patch\` | no | P1.2 |"; done
} >"$WORK/ledger" && cp "$WORK/ledger" pacs-ai/UPSTREAM_PATCHES.md
set +e
out=$("$DRIFT" "${DRIFT_ARGS[@]}" --enforce --forbid-ohif-ui 2>&1); rc=$?
set -e
assert_eq "enforce fails with 16 ledger rows" "$rc" 1
assert_eq "ledger rows counted" "$(count_of "$out" 'ledger rows')" 16
assert_contains "ledger limit reported" "$out" "ledger has 16 rows; the limit is 15"
assert_contains "missing patch file reported" "$out" "patch file pacs-ai/patches/missing-1.patch not found"
git checkout -q -- pacs-ai/UPSTREAM_PATCHES.md

echo "# check-upstream-drift.sh: theme-debt list, root configs, bun.lock"
w pacs-ai/THEME_DEBT.txt <<'EOF2'
# comment lines are ignored

src/theme.tsx | colours | P3.4 tokens
src/vars.css | variables | P3.4 tokens
src/label.tsx | label text, listed by hand | P3.4 chrome
README.md | does not differ | P3.4 tokens
src/theme.tsx | listed twice | P3.4 tokens
src/broken.tsx | no item
EOF2
w extensions/pacs-ai-core/babel.config.js <<'EOF2'
module.exports = require('../../babel.config.js');
EOF2
w extensions/pacs-ai-core/jest.config.js <<'EOF2'
const base = require('../../jest.config.base.js');
const other = require('../../babel.config.js');
EOF2
echo '# bun lock' >bun.lock
git add pacs-ai/THEME_DEBT.txt extensions/pacs-ai-core/babel.config.js extensions/pacs-ai-core/jest.config.js bun.lock
set +e
out=$("$DRIFT" "${DRIFT_ARGS[@]}" --enforce 2>&1); rc=$?
set -e
assert_eq "list: enforce fails" "$rc" 1
assert_eq "list: theme-debt files are the listed ones" "$(count_of "$out" 'theme-debt files')" 3
assert_eq "list: unlisted heuristic file is unexplained (8 - label + wrapped)" "$(count_of "$out" 'unexplained files')" 8
assert_eq "list: theme-list errors" "$(count_of "$out" 'theme-list errors')" 3
assert_contains "list: stale entry reported" "$out" "README.md does not differ from upstream"
assert_contains "list: duplicate reported" "$out" "src/theme.tsx listed twice"
assert_contains "list: malformed line reported" "$out" 'line 8: expected "path | what it changes | P3.4 item"'
assert_contains "list: unlisted theme-like file named" "$(sed -n '/^Unlisted files the theme heuristic/,/^$/p' <<<"$out")" "src/wrapped.tsx"
assert_contains "list: hand-listed file named" "$(sed -n '/^Listed theme-debt files the heuristic/,/^$/p' <<<"$out")" "src/label.tsx"
assert_contains "list: FAIL line counts theme-list errors" "$out" "3 theme-list error(s)"
viol=$(sed -n '/^Import-direction violations/,/^$/p' <<<"$out")
assert_not_contains "root babel config from package babel.config.js allowed" "$viol" $'extensions/pacs-ai-core/babel.config.js'
assert_not_contains "root jest base from package jest.config.js allowed" "$viol" $'jest.config.js\t../../jest.config.base.js'
assert_contains "other root file from jest.config.js still flagged" "$viol" $'ours-relative-cross-pkg\textensions/pacs-ai-core/jest.config.js\t../../babel.config.js'
assert_contains "bun.lock is expected" "$(sed -n '/^Expected files/,/^$/p' <<<"$out")" "bun.lock"
git rm -q --cached pacs-ai/THEME_DEBT.txt extensions/pacs-ai-core/babel.config.js extensions/pacs-ai-core/jest.config.js bun.lock
rm -f pacs-ai/THEME_DEBT.txt extensions/pacs-ai-core/babel.config.js extensions/pacs-ai-core/jest.config.js bun.lock

echo "# check-upstream-drift.sh: working tree and markdown"
echo 'export const x = 3;' >src/patched.ts
out=$("$DRIFT" "${DRIFT_ARGS[@]}" --report --markdown "$WORK/summary.md")
assert_eq "working tree is compared (count unchanged)" "$(count_of "$out" 'modified upstream files')" 13
assert_contains "markdown summary written" "$(cat "$WORK/summary.md")" "| Theme-debt files | 3 |"
git checkout -q -- src/patched.ts

echo "# check-upstream-drift.sh: fetch of a missing ref"
git update-ref -d refs/upstream/v1.0.0
out=$(UPSTREAM_URL="file://$UP" "$DRIFT" "${DRIFT_ARGS[@]}" --report 2>&1)
assert_contains "fetches missing tag" "$out" "refs/upstream/v1.0.0 missing; fetching tag v1.0.0"
assert_eq "fetched ref resolves" "$(git rev-parse "refs/upstream/v1.0.0^{commit}")" "$(git -C "$UP" rev-parse "v1.0.0^{commit}")"
assert_eq "no tags fetched" "$(git tag | wc -l | tr -d ' ')" 0
assert_eq "counts after fetch" "$(count_of "$out" 'modified upstream files')" 13
set +e
UPSTREAM_URL="file://$WORK/nowhere" "$DRIFT" --repo "$FORK" --report --rev "$CLEAN" >/dev/null 2>&1
rc=$?
set -e
assert_eq "existing ref needs no fetch" "$rc" 0

echo "# apply-patches.sh"
wt_count() { git -C "$FORK" worktree list | wc -l | tr -d ' '; }
before=$(wt_count)
out=$("$APPLY" --repo "$FORK" --fresh --check 2>&1); rc=$?
assert_eq "fresh check exits 0" "$rc" 0
assert_contains "fresh check applies patch" "$out" "applied          0001-patched.patch"
assert_eq "temporary worktree removed" "$(wt_count)" "$before"
out=$("$APPLY" --repo "$FORK" 2>&1); rc=$?
assert_eq "working tree apply exits 0" "$rc" 0
assert_contains "idempotent: already applied" "$out" "already applied  0001-patched.patch"
assert_eq "working tree unchanged" "$(git status --porcelain | wc -l | tr -d ' ')" 0

# A patch that applies on upstream but not yet on a target that lacks it.
git checkout -q "$CLEAN" -- src/patched.ts
git show refs/upstream/v1.0.0:src/patched.ts >src/patched.ts
out=$("$APPLY" --repo "$FORK" --check 2>&1); rc=$?
assert_eq "check on working tree exits 0" "$rc" 0
assert_contains "check reports applicable" "$out" "applies cleanly  0001-patched.patch"
assert_eq "check changes nothing" "$(cat src/patched.ts)" "export const z = 3;"
"$APPLY" --repo "$FORK" >/dev/null
assert_eq "apply changes the file" "$(cat src/patched.ts)" "export const z = 4;"
out=$("$APPLY" --repo "$FORK" 2>&1)
assert_contains "second run skips" "$out" "already applied  0001-patched.patch"

# A conflicting patch.
cat >pacs-ai/patches/0002-conflict.patch <<'EOF'
diff --git a/src/logic.ts b/src/logic.ts
--- a/src/logic.ts
+++ b/src/logic.ts
@@ -1 +1 @@
-export const x = 99;
+export const x = 100;
EOF
set +e
out=$("$APPLY" --repo "$FORK" --fresh 2>&1); rc=$?
set -e
assert_eq "conflict exits 1" "$rc" 1
assert_contains "conflict names the patch" "$out" "CONFLICT         0002-conflict.patch"
assert_contains "conflict says where it stopped" "$out" "stopped at 0002-conflict.patch"
kept=$(sed -n 's/^    worktree kept for inspection: //p' <<<"$out")
if [[ -n $kept && -d $kept ]]; then
  ok "conflict keeps worktree for inspection"
  git -C "$FORK" worktree remove --force "$kept"
else
  not_ok "conflict keeps worktree for inspection"
fi
set +e
out=$("$APPLY" --repo "$FORK" --check 2>&1); rc=$?
set -e
assert_eq "check reports conflict with exit 1" "$rc" 1
assert_contains "check lists both patches" "$out" "already applied  0001-patched.patch"
rm pacs-ai/patches/0002-conflict.patch

rm -f pacs-ai/patches/*.patch
out=$("$APPLY" --repo "$FORK" 2>&1); rc=$?
assert_eq "no patches exits 0" "$rc" 0
assert_contains "no patches message" "$out" "nothing to do"

echo
echo "passed: $PASS, failed: $FAIL"
[[ $FAIL -eq 0 ]]
