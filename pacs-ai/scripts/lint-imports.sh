#!/usr/bin/env bash
# lint-imports.sh: ESLint import rules of docs/ohif-upgrade/PLAN.md 3.5, 6.1, 6.2.
#
#   pacs-ai/scripts/lint-imports.sh        (from the repository root, after yarn install)
#
# 1. Our packages (extensions/pacs-ai-*, modes/pacs-ai) with their own
#    .eslintrc.json on top of the root config: counts the findings of
#    no-restricted-imports and import/no-relative-packages only (the other
#    rules of the root config are not part of this gate).
# 2. Upstream-owned code (platform/, extensions/, modes/ without ours) with
#    pacs-ai/eslint/upstream-imports.eslintrc.json alone: no @pacs-ai/* and,
#    outside platform/app, no @ohif/app/src.
# Exit status: 0 when both report 0 errors, 1 otherwise, 2 on setup errors.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 2
ESLINT=node_modules/.bin/eslint
[[ -x $ESLINT ]] || { echo "lint-imports: run yarn install first" >&2; exit 2; }
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
EXT=.js,.jsx,.ts,.tsx

"$ESLINT" --ext "$EXT" --no-error-on-unmatched-pattern -f json -o "$OUT/ours.json" \
  extensions/pacs-ai-*/src modes/pacs-ai/src
[[ -s $OUT/ours.json ]] || { echo "lint-imports: eslint failed on our packages" >&2; exit 2; }

mapfile -t UPSTREAM_DIRS < <(ls -d platform/*/src extensions/*/src modes/*/src 2>/dev/null |
  grep -vE '^(extensions/pacs-ai-[^/]+|modes/pacs-ai)/')
"$ESLINT" --no-eslintrc -c pacs-ai/eslint/upstream-imports.eslintrc.json --ext "$EXT" \
  --no-error-on-unmatched-pattern --ignore-pattern '**/node_modules/**' -f json -o "$OUT/upstream.json" \
  "${UPSTREAM_DIRS[@]}"
[[ -s $OUT/upstream.json ]] || { echo "lint-imports: eslint failed on upstream code" >&2; exit 2; }

node - "$OUT/ours.json" "$OUT/upstream.json" <<'JS'
const fs = require('fs');
const path = require('path');
const RULES = new Set(['no-restricted-imports', 'import/no-relative-packages']);
let failed = 0;
for (const [label, file] of [['our packages', process.argv[2]], ['upstream code', process.argv[3]]]) {
  const results = JSON.parse(fs.readFileSync(file, 'utf8'));
  const findings = [];
  for (const r of results) {
    for (const m of r.messages) {
      if (m.fatal) findings.push({ ...m, ruleId: 'parse-error' });
      else if (RULES.has(m.ruleId)) findings.push(m);
      if (m.fatal || RULES.has(m.ruleId)) findings[findings.length - 1].file = path.relative(process.cwd(), r.filePath);
    }
  }
  const errors = findings.filter(m => m.severity === 2).length;
  const warnings = findings.length - errors;
  console.log(`${label}: ${results.length} files, ${errors} error(s), ${warnings} warning(s) from the import rules`);
  for (const m of findings) {
    console.log(`  ${m.severity === 2 ? 'error' : 'warn '} ${m.file}:${m.line} ${m.ruleId}: ${m.message}`);
  }
  failed += errors;
}
process.exit(failed ? 1 : 0);
JS
