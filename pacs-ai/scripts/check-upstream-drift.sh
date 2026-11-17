#!/usr/bin/env bash
# check-upstream-drift.sh: drift guard for the PACS-AI fork of OHIF.
#
# Compares the working tree (or a commit given with --rev) with the upstream
# ref pinned in pacs-ai/UPSTREAM_REF and classifies every upstream-owned file
# that differs. Spec: docs/ohif-upgrade/PLAN.md, sections 6.1 and 6.2.
#
# Usage:
#   pacs-ai/scripts/check-upstream-drift.sh [--report|--enforce] [options]
#
# Modes:
#   --report    print the counts and the file lists; always exit 0 (default)
#   --enforce   exit 1 on any unexplained file, import violation, ledger row
#               over the limit, or ledger row naming a missing patch file
#
# Options:
#   --repo DIR          repository to check (default: the one holding this script)
#   --rev REV           compare commit REV instead of the working tree
#   --markdown FILE     also write a Markdown summary to FILE (for CI)
#   --forbid-ohif-ui    also flag imports of @ohif/ui from "ours" (after P2.1)
#   -h, --help          show this help
#
# Environment:
#   UPSTREAM_URL        where to fetch the pinned tag if refs/upstream/<tag> is
#                       missing (default https://github.com/OHIF/Viewers.git)
#
# Classes (each upstream-owned file that differs gets exactly one, in this order):
#   ledger      named in the first column of a row of pacs-ai/UPSTREAM_PATCHES.md
#   expected    generated or expected files listed in PLAN.md 6.2 rule 2
#               (lock files, root and app package.json, pluginConfig.json,
#               pnpm-workspace.yaml, .github/workflows/*, version.json,
#               version.txt, commit.txt)
#   theme       theme debt: a modified (M) text file whose diff changes nothing
#               but class names and colour values (heuristic below)
#   unexplained everything else, including added, deleted and binary files
#
# Theme-debt heuristic (exact definition; tested in tests/run-tests.sh):
#   1. Take the -U0 diff of the file. Removed lines form side A, added lines
#      side B (the leading -/+ is dropped).
#   2. On both sides drop comments: {/* ... */}, /* ... */ on one line,
#      <!-- ... --> on one line, and lines that start with //.
#   3. Split both sides into tokens: whitespace separates tokens, and each of
#      < > { } ( ) ; , is a token of its own. Call the results RAW_A, RAW_B.
#   4. Normalise both sides, then tokenise again (NORM_A, NORM_B). In order:
#      a. colour values become @C@: hex colours #rgb..#rrggbbaa; rgb(), rgba(),
#         hsl(), hsla() calls; HSL channel triplets such as "236 62% 5%"
#         (optionally "/ 50%"); the value of a CSS or JS colour property
#         (color, background, background-color, border[-side]-color,
#         outline-color, fill, stroke, caret-color, accent-color,
#         text-decoration-color) up to the next ; or }.
#      b. the arguments of @apply up to the next ; become @K@.
#      c. a quoted string ('...', "..." or `...`) becomes "@K@" when it holds one
#         or more class tokens and nothing else. A class token is optional "!",
#         optional variants ("hover:", "md:", "[&>svg]:"), optional "!", then
#         either a hyphenated word starting with a lowercase letter
#         (bg-white/10, text-xs, h-[51px], -mt-2) or one of the single-word
#         utilities flex grid block inline hidden contents border rounded
#         shadow outline ring transition truncate underline uppercase lowercase
#         capitalize italic absolute relative fixed sticky static visible
#         invisible grow shrink container table isolate antialiased transform
#         filter blur grayscale invert sepia.
#   5. The file is theme debt when RAW_A != RAW_B (something other than
#      whitespace or comments changed) and NORM_A == NORM_B (once class
#      strings and colours are masked, both sides are the same token stream).
#   Known limits: any hyphenated lowercase string literal ('mouse-down') counts
#   as a class list; a class list in a template literal that spans lines is not
#   recognised; line rewrapping that splits tokens differently is not theme debt.
#
# Import direction (PLAN.md 6.2 rule 1), checked on JS/TS files
# (.js .jsx .ts .tsx .mjs .cjs); an import is the string after from, import,
# import( or require(:
#   upstream-imports-ours     a line the fork added to an upstream-owned file
#                             imports @pacs-ai/* or a path through
#                             extensions/pacs-ai-*, modes/pacs-ai or pacs-ai/
#                             (files with a ledger row are exempt from this one)
#   upstream-imports-app-src  a line the fork added to an upstream-owned file
#                             imports @ohif/app/src
#   ours-imports-app-src      an "ours" file imports @ohif/app/src
#   ours-imports-ohif-ui      an "ours" file imports @ohif/ui (--forbid-ohif-ui)
#   ours-relative-cross-pkg   a file in extensions/pacs-ai-<x> or modes/pacs-ai
#                             imports a relative path outside its own package
#
# Exit status: 0 success (always in --report), 1 enforcement failure,
# 2 usage or setup error.

set -euo pipefail
export LC_ALL=C

usage() { sed -n '2,/^$/s/^# \{0,1\}//p' "$0"; }
die() { echo "check-upstream-drift: $*" >&2; exit 2; }

MODE=report
REPO=""
REV=""
MARKDOWN=""
FORBID_OHIF_UI=0
LEDGER_LIMIT=15
UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/OHIF/Viewers.git}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --report) MODE=report ;;
    --enforce) MODE=enforce ;;
    --repo) [[ $# -ge 2 ]] || die "--repo needs a value"; REPO=$2; shift ;;
    --rev) [[ $# -ge 2 ]] || die "--rev needs a value"; REV=$2; shift ;;
    --markdown) [[ $# -ge 2 ]] || die "--markdown needs a value"; MARKDOWN=$2; shift ;;
    --forbid-ohif-ui) FORBID_OHIF_UI=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
  shift
done

if [[ -z $REPO ]]; then
  REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel) \
    || die "cannot find the repository holding this script; use --repo"
fi
cd "$REPO" || die "cannot enter $REPO"
REPO=$(git rev-parse --show-toplevel) || die "$REPO is not a git repository"
cd "$REPO"

# The compared side: the working tree (no argument) or a commit.
TARGET=()
if [[ -n $REV ]]; then
  git rev-parse -q --verify "$REV^{commit}" >/dev/null || die "--rev $REV is not a commit"
  TARGET=("$REV")
fi

# Read an "ours" file from the compared side; prints nothing if absent.
read_side_file() {
  if [[ -n $REV ]]; then
    git show "$REV:$1" 2>/dev/null || true
  elif [[ -f $1 ]]; then
    cat "$1"
  fi
}
side_file_exists() {
  if [[ -n $REV ]]; then git cat-file -e "$REV:$1" 2>/dev/null; else [[ -f $1 ]]; fi
}

# ---------------------------------------------------------------- upstream ref
TAG=$(read_side_file pacs-ai/UPSTREAM_REF | tr -d '[:space:]')
[[ -n $TAG ]] || die "pacs-ai/UPSTREAM_REF is missing or empty"
[[ $TAG =~ ^[A-Za-z0-9._-]+$ ]] || die "pacs-ai/UPSTREAM_REF holds an invalid tag: $TAG"
UPREF="refs/upstream/$TAG"
if ! git rev-parse -q --verify "$UPREF^{commit}" >/dev/null; then
  echo "check-upstream-drift: $UPREF missing; fetching tag $TAG" >&2
  git fetch --no-tags --quiet "$UPSTREAM_URL" "+refs/tags/$TAG:$UPREF" >&2 \
    || die "could not fetch tag $TAG from $UPSTREAM_URL"
fi
BASE=$(git rev-parse --verify "$UPREF^{commit}")

# -------------------------------------------------------------------- ownership
is_ours() {
  case "$1" in
    extensions/pacs-ai-*/*|modes/pacs-ai/*|pacs-ai/*|tests/pacs-ai/*|docs/ohif-upgrade/*) return 0 ;;
    .github/workflows/pacs-ai-*.yml|.github/CODEOWNERS) return 0 ;;
  esac
  return 1
}
is_expected() {
  case "$1" in
    yarn.lock|pnpm-lock.yaml|package.json|platform/app/package.json) return 0 ;;
    platform/app/pluginConfig.json|pnpm-workspace.yaml) return 0 ;;
    .github/workflows/*|version.json|version.txt|commit.txt) return 0 ;;
  esac
  return 1
}
is_code() {
  case "$1" in *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs) return 0 ;; esac
  return 1
}

# ----------------------------------------------------------------------- ledger
LEDGER=pacs-ai/UPSTREAM_PATCHES.md
declare -A LEDGER_FILE=()
LEDGER_ROWS=0
LEDGER_ERRORS=()

trim() { local s=$1; s=${s#"${s%%[![:space:]]*}"}; s=${s%"${s##*[![:space:]]}"}; printf '%s' "$s"; }
unquote_cell() { local s; s=$(trim "$1"); s=${s//\`/}; trim "$s"; }

parse_ledger() {
  local line in_table=0 patch_col=-1 i cell file patch
  local -a cells
  while IFS= read -r line || [[ -n $line ]]; do
    if [[ $line != \|* ]]; then
      (( in_table )) && break
      continue
    fi
    line=${line#|}; line=${line%|}
    IFS='|' read -r -a cells <<<"$line"
    if (( ! in_table )); then
      cell=$(unquote_cell "${cells[0]:-}")
      if [[ ${cell,,} == file ]]; then
        in_table=1
        for i in "${!cells[@]}"; do
          cell=$(unquote_cell "${cells[$i]}")
          [[ ${cell,,} == patch* ]] && { patch_col=$i; break; }
        done
      fi
      continue
    fi
    [[ $line =~ ^[[:space:]:|-]+$ ]] && continue   # separator row
    file=$(unquote_cell "${cells[0]:-}")
    [[ -z $file ]] && continue
    LEDGER_ROWS=$((LEDGER_ROWS + 1))
    LEDGER_FILE[$file]=1
    if (( patch_col >= 0 )); then
      patch=$(unquote_cell "${cells[$patch_col]:-}")
      case "$patch" in
        ''|-|—|n/a|none) LEDGER_ERRORS+=("ledger row for $file names no patch file") ;;
        */*) side_file_exists "$patch" || LEDGER_ERRORS+=("ledger row for $file: patch file $patch not found") ;;
        *) side_file_exists "pacs-ai/patches/$patch" || LEDGER_ERRORS+=("ledger row for $file: patch file pacs-ai/patches/$patch not found") ;;
      esac
    fi
  done < <(read_side_file "$LEDGER")
}
parse_ledger

# ------------------------------------------------------------------ theme debt
Q_ALL="\"'\`"
CLS_VARIANT="([a-z0-9-]+:|\\[[^]${Q_ALL}[:space:]]*\\]:)*"
CLS_HYPH="-?[a-z][a-z0-9]*(-[^${Q_ALL}[:space:]]+)+"
CLS_WORD="(flex|grid|block|inline|hidden|contents|border|rounded|shadow|outline|ring|transition|truncate|underline|uppercase|lowercase|capitalize|italic|absolute|relative|fixed|sticky|static|visible|invisible|grow|shrink|container|table|isolate|antialiased|transform|filter|blur|grayscale|invert|sepia)"
CLS="!?${CLS_VARIANT}!?(${CLS_HYPH}|${CLS_WORD})"
CLS_LIST="[[:space:]]*${CLS}([[:space:]]+${CLS})*[[:space:]]*"
COLOR_PROPS="color|background|background-color|border(-(top|right|bottom|left))?-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color"

strip_comments() {
  sed -E \
    -e 's#\{/\*([^*]|\*+[^*/])*\*+/\}##g' \
    -e 's#/\*([^*]|\*+[^*/])*\*+/##g' \
    -e 's#<!--([^-]|-[^-]|--+[^->])*--+>##g' \
    -e 's#^[[:space:]]*//.*$##'
}
normalise_style() {
  sed -E \
    -e 's/#[0-9A-Fa-f]{3,8}([^0-9A-Za-z_-]|$)/@C@\1/g' \
    -e 's/(rgba?|hsla?)\([^)]*\)/@C@/g' \
    -e 's#-?[0-9.]+(deg)?[[:space:]]+[0-9.]+%[[:space:]]+[0-9.]+%([[:space:]]*/[[:space:]]*[0-9.]+%?)?#@C@#g' \
    -e "s/(^|[^A-Za-z0-9_-])(${COLOR_PROPS})([\"']?[[:space:]]*:)[^;}]*/\\1\\2\\3 @C@/g" \
    -e 's/@apply[^;]*/@apply @K@/g' \
    -e "s/\"${CLS_LIST}\"/\"@K@\"/g" \
    -e "s/'${CLS_LIST}'/\"@K@\"/g" \
    -e "s/\`${CLS_LIST}\`/\"@K@\"/g"
}
tokenise() {
  sed -E 's/([<>{}();,])/ \1 /g' | tr -s '[:space:]' '\n' | sed '/^$/d'
}

# Prints the diff body lines of one side ("-" or "+") of a single-file -U0 diff.
diff_side() {
  local sign=$1
  sed -n '/^@@/,$p' | grep -E "^[${sign}]" | cut -c2- || true
}

is_theme_debt() {
  local path=$1 diff rem add raw_a raw_b norm_a norm_b
  diff=$(git diff -U0 --no-color --no-ext-diff --no-textconv "$BASE" "${TARGET[@]}" -- "$path")
  rem=$(printf '%s\n' "$diff" | diff_side - | strip_comments)
  add=$(printf '%s\n' "$diff" | diff_side + | strip_comments)
  raw_a=$(printf '%s\n' "$rem" | tokenise)
  raw_b=$(printf '%s\n' "$add" | tokenise)
  [[ $raw_a != "$raw_b" ]] || return 1
  norm_a=$(printf '%s\n' "$rem" | normalise_style | tokenise)
  norm_b=$(printf '%s\n' "$add" | normalise_style | tokenise)
  [[ $norm_a == "$norm_b" ]]
}

# ----------------------------------------------------------------- classify
declare -a C_LEDGER=() C_EXPECTED=() C_THEME=() C_UNEXPLAINED=()
MODIFIED=0
while IFS= read -r -d '' status && IFS= read -r -d '' path; do
  is_ours "$path" && continue
  MODIFIED=$((MODIFIED + 1))
  entry="$status	$path"
  if [[ -n ${LEDGER_FILE[$path]:-} ]]; then
    C_LEDGER+=("$entry")
  elif is_expected "$path"; then
    C_EXPECTED+=("$entry")
  elif [[ $status == M ]] && is_theme_debt "$path"; then
    C_THEME+=("$entry")
  else
    C_UNEXPLAINED+=("$entry")
  fi
done < <(git diff --no-renames --no-ext-diff --name-status -z "$BASE" "${TARGET[@]}" --)

# ---------------------------------------------------------- import direction
IMPORT_RE="(^|[^A-Za-z0-9_\$.])(from|import|require)[[:space:]]*\\(?[[:space:]]*['\"][^'\"]+['\"]"
VIOLATIONS=()

# Prints each import specifier on the given line.
specifiers() {
  grep -oE "$IMPORT_RE" <<<"$1" | sed -E "s/.*['\"]([^'\"]+)['\"]\$/\\1/" || true
}

# Normalises a relative path (a/b/../c -> a/c) without touching the disk.
normalise_path() {
  local -a parts out=()
  local p
  IFS='/' read -r -a parts <<<"$1"
  for p in "${parts[@]}"; do
    case "$p" in
      ''|.) ;;
      ..) if ((${#out[@]})) && [[ ${out[-1]} != .. ]]; then unset 'out[-1]'; else out+=(..); fi ;;
      *) out+=("$p") ;;
    esac
  done
  local IFS=/
  printf '%s' "${out[*]}"
}

package_root() {
  case "$1" in
    extensions/pacs-ai-*/*) local rest=${1#extensions/}; printf 'extensions/%s' "${rest%%/*}" ;;
    modes/pacs-ai/*) printf 'modes/pacs-ai' ;;
  esac
}

# Lines the fork added to upstream-owned code files.
current=""
while IFS= read -r line; do
  if [[ $line == '+++ '* ]]; then
    current=${line#+++ }; current=${current#b/}
    [[ $current == /dev/null ]] && current=""
    continue
  fi
  [[ -n $current ]] || continue
  is_ours "$current" && continue
  is_code "$current" || continue
  while IFS= read -r spec; do
    [[ -n $spec ]] || continue
    if [[ $spec == @ohif/app/src || $spec == @ohif/app/src/* ]]; then
      VIOLATIONS+=("upstream-imports-app-src	$current	$spec")
    elif [[ -z ${LEDGER_FILE[$current]:-} ]] &&
         [[ $spec == @pacs-ai/* || $spec =~ (^|/)(extensions/pacs-ai-[^/]+|modes/pacs-ai|pacs-ai)(/|$) ]]; then
      VIOLATIONS+=("upstream-imports-ours	$current	$spec")
    fi
  done < <(specifiers "${line#+}")
done < <(git diff -U0 --no-color --no-renames --no-ext-diff "$BASE" "${TARGET[@]}" -- \
           | grep -E "^(\+\+\+ |\+.*(from|import|require))" || true)


# Imports in "ours" code files.
list_side_files() {
  if [[ -n $REV ]]; then git ls-tree -r -z --name-only "$REV"; else git ls-files -z; fi
}
while IFS= read -r -d '' path; do
  if ! is_ours "$path" || ! is_code "$path"; then continue; fi
  root=$(package_root "$path")
  while IFS= read -r line; do
    while IFS= read -r spec; do
      [[ -n $spec ]] || continue
      if [[ $spec == @ohif/app/src || $spec == @ohif/app/src/* ]]; then
        VIOLATIONS+=("ours-imports-app-src	$path	$spec")
      elif (( FORBID_OHIF_UI )) && [[ $spec == @ohif/ui || $spec == @ohif/ui/* ]]; then
        VIOLATIONS+=("ours-imports-ohif-ui	$path	$spec")
      elif [[ -n $root && $spec == .* ]]; then
        target=$(normalise_path "$(dirname "$path")/$spec")
        if [[ $target != "$root" && $target != "$root"/* ]]; then
          VIOLATIONS+=("ours-relative-cross-pkg	$path	$spec")
        fi
      fi
    done < <(specifiers "$line")
  done < <(read_side_file "$path" | grep -E "(from|import|require)" || true)
done < <(list_side_files)

# ------------------------------------------------------------------- output
UNEXPLAINED=${#C_UNEXPLAINED[@]}
THEME=${#C_THEME[@]}
mapfile -t VIOLATIONS < <(((${#VIOLATIONS[@]})) && printf '%s\n' "${VIOLATIONS[@]}" | sort -u)
NVIOL=${#VIOLATIONS[@]}
if (( LEDGER_ROWS > LEDGER_LIMIT )); then
  LEDGER_ERRORS+=("ledger has $LEDGER_ROWS rows; the limit is $LEDGER_LIMIT")
fi
NLEDGER_ERR=${#LEDGER_ERRORS[@]}

print_list() {
  local title=$1; shift
  echo
  echo "$title ($#):"
  if (($#)); then printf '  %s\n' "$@"; else echo "  (none)"; fi
}

echo "Upstream drift: $TAG ($BASE) vs ${REV:-working tree}"
echo
printf '%-34s %6d\n' "modified upstream files:" "$MODIFIED"
printf '%-34s %6d\n' "theme-debt files:" "$THEME"
printf '%-34s %6d   (limit %d)\n' "ledger rows:" "$LEDGER_ROWS" "$LEDGER_LIMIT"
printf '%-34s %6d\n' "unexplained files:" "$UNEXPLAINED"
printf '%-34s %6d\n' "ledger-patched files:" "${#C_LEDGER[@]}"
printf '%-34s %6d\n' "expected (generated) files:" "${#C_EXPECTED[@]}"
printf '%-34s %6d\n' "import-direction violations:" "$NVIOL"
printf '%-34s %6d\n' "ledger errors:" "$NLEDGER_ERR"
print_list "Ledger errors" "${LEDGER_ERRORS[@]}"
print_list "Import-direction violations (rule, file, import)" "${VIOLATIONS[@]}"
print_list "Unexplained files (status, path)" "${C_UNEXPLAINED[@]}"
print_list "Theme-debt files" "${C_THEME[@]}"
print_list "Ledger-patched files" "${C_LEDGER[@]}"
print_list "Expected files" "${C_EXPECTED[@]}"

if [[ -n $MARKDOWN ]]; then
  md_list() {
    local title=$1; shift
    printf '\n<details><summary>%s (%d)</summary>\n\n```\n' "$title" "$#"
    (($#)) && printf '%s\n' "$@"
    printf '```\n</details>\n'
  }
  {
    echo "## Upstream drift ($MODE)"
    echo
    echo "Upstream \`$TAG\` (\`${BASE:0:12}\`) vs \`${REV:-working tree}\`"
    echo
    echo "| Measure | Count |"
    echo "|---|---:|"
    echo "| Modified upstream files | $MODIFIED |"
    echo "| Theme-debt files | $THEME |"
    echo "| Ledger rows (limit $LEDGER_LIMIT) | $LEDGER_ROWS |"
    echo "| Unexplained files | $UNEXPLAINED |"
    echo "| Ledger-patched files | ${#C_LEDGER[@]} |"
    echo "| Expected (generated) files | ${#C_EXPECTED[@]} |"
    echo "| Import-direction violations | $NVIOL |"
    echo "| Ledger errors | $NLEDGER_ERR |"
    md_list "Ledger errors" "${LEDGER_ERRORS[@]}"
    md_list "Import-direction violations" "${VIOLATIONS[@]}"
    md_list "Unexplained files" "${C_UNEXPLAINED[@]}"
    md_list "Theme-debt files" "${C_THEME[@]}"
  } >"$MARKDOWN"
fi

if [[ $MODE == enforce ]]; then
  if (( UNEXPLAINED || NVIOL || NLEDGER_ERR )); then
    echo
    echo "FAIL: $UNEXPLAINED unexplained file(s), $NVIOL import violation(s), $NLEDGER_ERR ledger error(s)" >&2
    exit 1
  fi
  echo
  echo "OK: no unexplained drift"
fi
exit 0
