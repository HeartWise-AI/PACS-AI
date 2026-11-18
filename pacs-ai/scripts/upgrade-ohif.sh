#!/usr/bin/env bash
# upgrade-ohif.sh: merge a new OHIF release into the PACS-AI integration
# branch with the rules of docs/ohif-upgrade/PLAN.md 9 (P3.1, rules 1-8),
# then check the result. Runbook: docs/ohif-upgrade/RUNBOOK.md.
#
# Usage:
#   pacs-ai/scripts/upgrade-ohif.sh [options] <tag>
#   pacs-ai/scripts/upgrade-ohif.sh --checks-only [options]
#
#   <tag>          an OHIF tag (v3.14.0), "latest" (newest v3.x.y or
#                  v3.x.y-beta.n tag), or "latest:<prefix>" (newest tag that
#                  starts with the prefix, e.g. latest:v3.14)
#
# What it does (in the repository's working tree):
#   1. fetches the tag to refs/upstream/<tag> (and the pinned one, read from
#      pacs-ai/UPSTREAM_REF, if missing);
#   2. moves the untracked platform/app/.env aside (git overwrites ignored
#      files when a merge brings a tracked file at that path) and puts it
#      back at the end;
#   3. creates the branch upgrade/<tag> from the base (default HEAD) and runs
#      `git merge --no-commit refs/upstream/<tag>`;
#   4. resolves every path that the pinned tag, the base or the new tag
#      disagree on, by rule (P = pinned tag, O = base, T = new tag):
#        1 "ours" path (PLAN 6.1)                  -> O
#        2 ledger file (pacs-ai/UPSTREAM_PATCHES.md) -> T, then the ledger
#          patches (apply-patches.sh); patches that need it are refreshed
#          against T; an "untrack" patch (deletion only, e.g. 0006 .env)
#          that no longer applies is regenerated
#        3 file in pacs-ai/THEME_DEBT.txt (if any) -> T
#        4 package.json, platform/app/package.json, pluginConfig.json -> T
#          plus our entries (merge-manifest.py, three-way against P)
#        5 pnpm-lock.yaml -> O when upstream's lock and all manifests are
#          unchanged, else T regenerated with `pnpm install --lockfile-only`;
#          yarn.lock and bun.lock are deleted
#        expected files (pnpm-workspace.yaml, .github/workflows/*,
#          version.json/.txt, commit.txt) -> three-way `git merge-file`
#          against P; a workflow we disabled (X deleted, X.disabled added)
#          stays disabled and X.disabled gets T's X
#        6 upstream-owned file we deleted, upstream changed -> T
#        7 upstream-owned file we changed, upstream deleted -> deleted
#        8 every other upstream-owned path -> T; our edits that this drops
#          (the drift guard should have caught them) are listed as lost
#   5. writes pacs-ai/UPSTREAM_REF and commits a two-parent merge commit
#      (nothing when the tag is already merged and no rule changes a file);
#   6. runs the checks: ledger patches on a fresh tag checkout, drift guard
#      (--enforce --forbid-ohif-ui), then in a node:<.node-version>-slim
#      container with pnpm from "packageManager": pnpm install
#      --frozen-lockfile, build (APP_CONFIG=config/pacs-ai.js),
#      lint-imports.sh, unit tests (pnpm -r --no-bail --no-sort run test:unit:ci),
#      and with --typecheck the tsc error count of each of our packages;
#   7. prints a summary (also <log dir>/summary.txt and summary.md).
#
# Options:
#   --base REF          start the upgrade branch from REF (default HEAD)
#   --branch NAME       branch name (default upgrade/<tag>)
#   --force             replace an existing branch of that name
#   --dry-run           resolve and stage the merge but do not commit; the
#                       checks run on the working tree
#   --keep-going        do not stop at the first problem: a patch that does
#                       not apply leaves the file at upstream's version, a
#                       conflict keeps upstream's side, the merge is
#                       committed and every check runs (the summary lists
#                       what was kept from upstream)
#   --no-build          skip the build
#   --no-checks         merge only: no lockfile regeneration, no checks
#   --checks-only       no merge: run the checks of step 6 on the working tree
#                       as it is (after you fixed a stopped or red upgrade);
#                       the tag defaults to pacs-ai/UPSTREAM_REF
#   --typecheck         also count tsc errors per PACS-AI package (report only)
#   --no-docker         run the Node steps on this machine (node and pnpm on
#                       PATH, versions as above) instead of in Docker
#   --log-dir DIR       logs and summary (default: a new directory under
#                       ${TMPDIR:-/tmp}); never holds platform/app/.env
#   --cache-dir DIR     pnpm CLI and store for the container (default
#                       ${XDG_CACHE_HOME:-~/.cache}/pacs-ai-upgrade-ohif)
#   --upstream-url URL  OHIF repository (default $UPSTREAM_URL or
#                       https://github.com/OHIF/Viewers.git)
#   --repo DIR          repository (default: the one holding this script)
#   -h, --help          show this help
#
# Without --keep-going the script stops at the first problem. Before the
# commit (patch or merge conflict) it leaves the merge uncommitted on the
# branch for you to finish; after it, the branch stays for inspection.
# Exit status: 0 everything passed, 1 a conflict or a check failed (branch
# left for inspection), 2 usage or setup error.

set -euo pipefail
export LC_ALL=C

usage() { sed -n '2,/^$/s/^# \{0,1\}//p' "$0"; }
die() { echo "upgrade-ohif: $*" >&2; exit 2; }

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TAG=""
BASE=HEAD
BRANCH=""
FORCE=0
DRY_RUN=0
KEEP_GOING=0
NO_BUILD=0
NO_CHECKS=0
TYPECHECK=0
CHECKS_ONLY=0
USE_DOCKER=1
LOG_DIR=""
CACHE_DIR=${XDG_CACHE_HOME:-$HOME/.cache}/pacs-ai-upgrade-ohif
UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/OHIF/Viewers.git}
REPO=""
ENV_FILE=platform/app/.env

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) [[ $# -ge 2 ]] || die "--base needs a value"; BASE=$2; shift ;;
    --branch) [[ $# -ge 2 ]] || die "--branch needs a value"; BRANCH=$2; shift ;;
    --force) FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --keep-going) KEEP_GOING=1 ;;
    --no-build) NO_BUILD=1 ;;
    --no-checks) NO_CHECKS=1 ;;
    --typecheck) TYPECHECK=1 ;;
    --checks-only) CHECKS_ONLY=1 ;;
    --no-docker) USE_DOCKER=0 ;;
    --log-dir) [[ $# -ge 2 ]] || die "--log-dir needs a value"; LOG_DIR=$2; shift ;;
    --cache-dir) [[ $# -ge 2 ]] || die "--cache-dir needs a value"; CACHE_DIR=$2; shift ;;
    --upstream-url) [[ $# -ge 2 ]] || die "--upstream-url needs a value"; UPSTREAM_URL=$2; shift ;;
    --repo) [[ $# -ge 2 ]] || die "--repo needs a value"; REPO=$2; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1 (see --help)" ;;
    *) [[ -z $TAG ]] || die "only one tag, please"; TAG=$1 ;;
  esac
  shift
done
(( CHECKS_ONLY && NO_CHECKS )) && die "--checks-only and --no-checks exclude each other"

if [[ -z $REPO ]]; then
  REPO=$(cd "$HERE" && git rev-parse --show-toplevel) || die "cannot find the repository; use --repo"
fi
REPO=$(cd "$REPO" && git rev-parse --show-toplevel) || die "$REPO is not a git repository"
cd "$REPO"

# ------------------------------------------------------------------ helpers
g() { git -c core.quotePath=false "$@"; }

TAG_RE='^v([0-9]+)\.([0-9]+)\.([0-9]+)(-(alpha|beta|rc)\.([0-9]+))?$'
# Newest release tag of UPSTREAM_URL starting with $1 (a final release sorts
# after its betas).
latest_tag() {
  local prefix=$1
  g ls-remote --tags --refs "$UPSTREAM_URL" 'v*' | awk '{print $2}' | sed 's#^refs/tags/##' |
    grep -E "$TAG_RE" | { grep -F -- "$prefix" || true; } | awk -v p="$prefix" '
      index($0, p) == 1 {
        v = $0; sub(/^v/, "", v); split(v, a, /[.-]/)
        rank = 3; n = 0
        if ($0 ~ /-alpha\./) rank = 0; else if ($0 ~ /-beta\./) rank = 1; else if ($0 ~ /-rc\./) rank = 2
        if (rank < 3) n = a[5]
        printf "%09d %09d %09d %d %09d %s\n", a[1], a[2], a[3], rank, n, $0
      }' | sort | tail -n 1 | awk '{print $6}'
}

if [[ -z $TAG ]]; then
  (( CHECKS_ONLY )) || die "missing <tag> (see --help)"
  TAG=$(tr -d '[:space:]' <pacs-ai/UPSTREAM_REF 2>/dev/null || true)
fi
case "$TAG" in
  latest) TAG=$(latest_tag v) ;;
  latest:*) TAG=$(latest_tag "${TAG#latest:}") ;;
esac
[[ -n $TAG ]] || die "no matching tag found at $UPSTREAM_URL"
[[ $TAG =~ ^[A-Za-z0-9._-]+$ ]] || die "invalid tag: $TAG"
BRANCH=${BRANCH:-upgrade/$TAG}
TAGREF=refs/upstream/$TAG

if [[ -z $LOG_DIR ]]; then
  LOG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/upgrade-ohif.$TAG.XXXXXX")
else
  mkdir -p "$LOG_DIR"
  LOG_DIR=$(cd "$LOG_DIR" && pwd)
fi
case "$LOG_DIR/" in "$REPO"/*) die "--log-dir must be outside the repository" ;; esac
RUN_LOG=$LOG_DIR/run.log
: >"$RUN_LOG"
say() { printf '%s\n' "$*" | tee -a "$RUN_LOG"; }
step() { say ""; say "== $*"; }

# ---------------------------------------------------------------- preflight
ATTENTION=()   # conflicts that need a person (keep-going: upstream kept)
FAILED=()      # failed checks
LOST=()        # rule 8: our edits dropped
NOTES=()
UNMERGED=() PATHS=() PATCH_NAMES=()
declare -A PSTATUS=() SET_BY_RULE=() CONFLICTS_BY_RULE=()
COMMITTED="" STOPPED="" MERGING=0 AUTO_RESET=0 LOCK_REGEN=0
ENV_BACKUP="" ENV_NOTE=""
# The merge (steps 1-5); skipped with --checks-only. Ends at "end of the merge".
if (( ! CHECKS_ONLY )); then
g rev-parse -q --verify MERGE_HEAD >/dev/null && die "a merge is in progress; finish or abort it first"
if [[ -n $(g status --porcelain --untracked-files=normal) ]]; then
  die "the working tree has changes or untracked files; commit them or set them aside first (ignored files are fine)"
fi
g var GIT_COMMITTER_IDENT >/dev/null 2>&1 ||
  die "git has no committer identity; set user.name and user.email (or GIT_COMMITTER_NAME/EMAIL and GIT_AUTHOR_NAME/EMAIL)"
BASE_REV=$(g rev-parse -q --verify "$BASE^{commit}") || die "--base $BASE is not a commit"
PREV=$(g show "$BASE_REV:pacs-ai/UPSTREAM_REF" 2>/dev/null | tr -d '[:space:]') || true
[[ $PREV =~ ^[A-Za-z0-9._-]+$ ]] || die "pacs-ai/UPSTREAM_REF at $BASE is missing or invalid"
PREVREF=refs/upstream/$PREV

fetch_tag() {
  local t=$1
  g rev-parse -q --verify "refs/upstream/$t^{commit}" >/dev/null && return 0
  say "fetching $t from $UPSTREAM_URL"
  g fetch --no-tags --quiet "$UPSTREAM_URL" "+refs/tags/$t:refs/upstream/$t" || die "could not fetch tag $t"
}
fetch_tag "$PREV"
fetch_tag "$TAG"
P=$(g rev-parse "$PREVREF^{commit}")
T=$(g rev-parse "$TAGREF^{commit}")
if [[ $P != "$T" ]] && g merge-base --is-ancestor "$T" "$P"; then
  die "$TAG is older than the pinned $PREV; this script only moves forward"
fi
if g rev-parse -q --verify "refs/heads/$BRANCH" >/dev/null; then
  [[ $FORCE == 1 ]] || die "branch $BRANCH exists; use --force to replace it or --branch to name another"
  if [[ $(g symbolic-ref -q --short HEAD || true) == "$BRANCH" ]]; then
    die "branch $BRANCH is checked out; switch away first"
  fi
fi

step "upgrade-ohif: $PREV -> $TAG"
say "base:     $BASE (${BASE_REV:0:12})"
say "upstream: $TAGREF (${T:0:12}), pinned $PREVREF (${P:0:12})"
say "branch:   $BRANCH$( ((DRY_RUN)) && echo ' (dry run: no commit)')"
say "logs:     $LOG_DIR"

# ---------------------------------------------------- platform/app/.env aside
restore_env() {
  [[ -n $ENV_BACKUP && -f $ENV_BACKUP/env ]] || return 0
  if g ls-files --error-unmatch -- "$ENV_FILE" >/dev/null 2>&1 || [[ -e $ENV_FILE ]]; then
    ENV_NOTE="$ENV_FILE is tracked or present again; your file was NOT put back: it is in $ENV_BACKUP/env"
    echo "upgrade-ohif: $ENV_NOTE" >&2
    return 0
  fi
  mv "$ENV_BACKUP/env" "$ENV_FILE" && rmdir "$ENV_BACKUP" && ENV_BACKUP=""
  ENV_NOTE="$ENV_FILE restored"
  if ! g check-ignore -q -- "$ENV_FILE"; then
    ENV_NOTE="$ENV_NOTE (WARNING: not git-ignored on this branch; do not add it)"
  fi
}
trap 'restore_env' EXIT
if [[ -e $ENV_FILE ]] && ! g ls-files --error-unmatch -- "$ENV_FILE" >/dev/null 2>&1; then
  ENV_BACKUP=$(mktemp -d "${TMPDIR:-/tmp}/upgrade-ohif-env.XXXXXX")
  chmod 700 "$ENV_BACKUP"
  mv "$ENV_FILE" "$ENV_BACKUP/env"
  say "moved the untracked $ENV_FILE aside (restored at the end)"
fi

# --------------------------------------------------------------- classify
is_ours() {
  case "$1" in
    extensions/pacs-ai-*/*|modes/pacs-ai/*|pacs-ai/*|tests/pacs-ai/*|docs/ohif-upgrade/*) return 0 ;;
    .github/workflows/pacs-ai-*.yml|.github/CODEOWNERS) return 0 ;;
  esac
  return 1
}
is_manifest() {
  case "$1" in package.json|platform/app/package.json|platform/app/pluginConfig.json) return 0 ;; esac
  return 1
}
is_lock() {
  case "$1" in pnpm-lock.yaml|yarn.lock|bun.lock) return 0 ;; esac
  return 1
}
is_expected() {
  case "$1" in pnpm-workspace.yaml|.github/workflows/*|version.json|version.txt|commit.txt) return 0 ;; esac
  return 1
}

# Ledger: first column of the first table of pacs-ai/UPSTREAM_PATCHES.md (base).
declare -A LEDGER=()
while IFS= read -r f; do [[ -n $f ]] && LEDGER[$f]=1; done < <(
  g show "$BASE_REV:pacs-ai/UPSTREAM_PATCHES.md" 2>/dev/null | awk -F'|' '
    /^\|/ { if (!t) { c = $2; gsub(/[ `]/, "", c); if (tolower(c) == "file") t = 1; next }
            c = $2; gsub(/[ `]/, "", c); if (c ~ /^[-:]*$/) next; print c; next }
    t { exit }')
declare -A THEME=()
while IFS= read -r f; do [[ -n $f ]] && THEME[$f]=1; done < <(
  g show "$BASE_REV:pacs-ai/THEME_DEBT.txt" 2>/dev/null | grep -vE '^[[:space:]]*(#|$)' |
    cut -d'|' -f1 | sed 's/[[:space:]]*$//; s/^[[:space:]]*//')

# Tree maps (path -> "mode sha") of P, O and T.
declare -A TP=() TO=() TT=()
# shellcheck disable=SC2034 # tree_map is a nameref to the caller's map
load_tree() {
  local -n tree_map=$1
  local meta path
  while IFS=$'\t' read -r -d '' meta path; do
    tree_map["$path"]="${meta%% *} ${meta##* }"
  done < <(g ls-tree -r -z --full-tree "$2")
}
load_tree TP "$P"
load_tree TO "$BASE_REV"
load_tree TT "$T"
blob() { local -n m=$1; printf '%s' "${m[$2]:-}"; }

# Rule of a path (for counting git's conflicts and the paths set).
rule_of() {
  local p=$1
  if is_ours "$p"; then echo 1
  elif [[ -n ${LEDGER[$p]:-} ]]; then echo 2
  elif [[ -n ${THEME[$p]:-} ]]; then echo 3
  elif is_manifest "$p"; then echo 4
  elif is_lock "$p"; then echo 5
  elif is_expected "$p"; then echo E
  elif [[ -n ${TP[$p]:-} && -z ${TO[$p]:-} ]]; then echo 6
  elif [[ -n ${TP[$p]:-} && -z ${TT[$p]:-} && ${TO[$p]:-} != "${TP[$p]}" ]]; then echo 7
  else echo 8
  fi
}
RULE_NAME=([1]="1 ours: kept" [2]="2 ledger: upstream + patch" [3]="3 theme debt: upstream"
  [4]="4 manifests: upstream + ours" [5]="5 lock files" [6]="6 deleted by us: upstream's restored"
  [7]="7 changed by us, deleted upstream: deleted" [8]="8 other upstream-owned: upstream")
RULE_KEYS=(1 2 3 4 5 E 6 7 8)
RULE_NAME_E="- expected files: three-way"
rule_label() { if [[ $1 == E ]]; then echo "$RULE_NAME_E"; else echo "${RULE_NAME[$1]}"; fi; }

# ------------------------------------------------------------------- merge
step "merge"
g switch -q -C "$BRANCH" "$BASE_REV"
merge_rc=0
g merge --no-commit --no-ff -X no-renames -m "Merge OHIF $TAG (upgrade-ohif.sh)" "$TAGREF" \
  >"$LOG_DIR/git-merge.log" 2>&1 || merge_rc=$?
g rev-parse -q --verify MERGE_HEAD >/dev/null && MERGING=1
mapfile -d '' -t UNMERGED < <(g diff --name-only --diff-filter=U -z)
if (( merge_rc != 0 && ${#UNMERGED[@]} == 0 )); then
  cat "$LOG_DIR/git-merge.log" >&2
  die "git merge failed (see above); the branch $BRANCH is left as is"
fi
if (( ! MERGING )); then
  say "git merge: $TAG is already merged into the base (no merge commit needed)"
else
  say "git merge: ${#UNMERGED[@]} conflicted path(s) (log: git-merge.log)"
fi
declare -A IS_UNMERGED=()
for p in "${UNMERGED[@]}"; do
  IS_UNMERGED[$p]=1
  r=$(rule_of "$p")
  CONFLICTS_BY_RULE[$r]=$(( ${CONFLICTS_BY_RULE[$r]:-0} + 1 ))
done
# Paths where git's own (clean) merge result differs from upstream's file.
declare -A GIT_DIFFERS=()
while IFS= read -r -d '' p; do GIT_DIFFERS[$p]=1; done < <(g diff --name-only --no-renames -z "$TAGREF" --)

# --------------------------------------------------------------- resolve
step "apply the rules"
mapfile -d '' -t PATHS < <({ g diff --name-only --no-renames -z "$P" "$T" --; g diff --name-only --no-renames -z "$P" "$BASE_REV" --; } | sort -zu)
say "${#PATHS[@]} path(s) differ between $PREV, the base and $TAG"

TO_T=() TO_O=() MANIFESTS=() EXPECTED=() LEDGER_PATHS=() DISABLED=()
for p in "${PATHS[@]}"; do
  r=$(rule_of "$p")
  case $r in
    1) TO_O+=("$p")
       [[ $(blob TP "$p") != "$(blob TT "$p")" ]] && NOTES+=("rule 1: upstream also changed our path $p (kept ours)")
       [[ $p == .github/workflows/*.disabled ]] && DISABLED+=("$p") ;;
    2) LEDGER_PATHS+=("$p"); TO_T+=("$p") ;;
    3) TO_T+=("$p") ;;
    4) MANIFESTS+=("$p") ;;
    5) ;;  # below
    E) if [[ $p == .github/workflows/*.disabled ]]; then DISABLED+=("$p"); TO_O+=("$p"); else EXPECTED+=("$p"); fi ;;
    6) TO_T+=("$p")
       [[ $(blob TP "$p") == "$(blob TT "$p")" ]] && LOST+=("$p (deleted by us; upstream did not change it)") ;;
    7) TO_T+=("$p") ;;
    8) TO_T+=("$p")
       po=$(blob TO "$p"); pp=$(blob TP "$p")
       [[ $po != "$pp" ]] && LOST+=("$p")
       [[ -n ${GIT_DIFFERS[$p]:-} && -z ${IS_UNMERGED[$p]:-} && $po == "$pp" ]] && AUTO_RESET=$((AUTO_RESET + 1)) ;;
  esac
  [[ $r == 5 ]] || SET_BY_RULE[$r]=$(( ${SET_BY_RULE[$r]:-0} + 1 ))
done

# Set paths to the version in a commit (deleting those it does not have).
set_from() {
  local commit=$1; shift
  local -n from_map=$1; shift
  local p have=() gone=()
  for p in "$@"; do if [[ -n ${from_map[$p]:-} ]]; then have+=("$p"); else gone+=("$p"); fi; done
  if ((${#have[@]})); then
    printf '%s\0' "${have[@]}" | g --literal-pathspecs checkout -q "$commit" --pathspec-from-file=- --pathspec-file-nul
  fi
  if ((${#gone[@]})); then
    printf '%s\0' "${gone[@]}" | g --literal-pathspecs rm -q -f --ignore-unmatch --pathspec-from-file=- --pathspec-file-nul
    for p in "${gone[@]}"; do rm -f -- "$p"; done
  fi
}
((${#TO_T[@]})) && set_from "$T" TT "${TO_T[@]}"
((${#TO_O[@]})) && set_from "$BASE_REV" TO "${TO_O[@]}"

TMPD=$(mktemp -d "${TMPDIR:-/tmp}/upgrade-ohif-work.XXXXXX")
trap 'rm -rf "$TMPD"; restore_env' EXIT
show() { g show "$1:$2" >"$3" 2>/dev/null || : >"$3"; }

# Rule 4: manifests.
MANIFEST_CHANGED=0
for p in "${MANIFESTS[@]}"; do
  if [[ -z ${TP[$p]:-} || -z ${TO[$p]:-} || -z ${TT[$p]:-} ]]; then
    set_from "$T" TT "$p"
    ATTENTION+=("rule 4: $p is missing in $PREV, the base or $TAG; took upstream's, re-add our entries by hand")
    MANIFEST_CHANGED=1
    continue
  fi
  show "$P" "$p" "$TMPD/base"; show "$BASE_REV" "$p" "$TMPD/ours"; show "$T" "$p" "$TMPD/theirs"
  rc=0
  python3 -I "$HERE/merge-manifest.py" --label "$p" "$TMPD/base" "$TMPD/ours" "$TMPD/theirs" -o "$p" \
    >"$TMPD/mm.out" 2>&1 || rc=$?
  tee -a "$RUN_LOG" <"$TMPD/mm.out" | sed -n 's/^merged /  /p'
  if (( rc == 2 )); then
    set_from "$T" TT "$p"
    ATTENTION+=("rule 4: $p could not be merged (merge-manifest.py); took upstream's")
  elif (( rc == 1 )); then
    while IFS=$'\t' read -r _ what ours theirs; do
      ATTENTION+=("rule 4: $what: $ours, $theirs")
    done < <(grep '^conflict' "$TMPD/mm.out")
  fi
  g add -- "$p"
  cmp -s "$p" "$TMPD/ours" || MANIFEST_CHANGED=1
done

# Expected files: three-way against P.
WORKSPACE_CHANGED=0
for p in "${EXPECTED[@]}"; do
  bp=$(blob TP "$p"); bo=$(blob TO "$p"); bt=$(blob TT "$p")
  if [[ $bo == "$bp" ]]; then set_from "$T" TT "$p"
  elif [[ $bt == "$bp" || $bo == "$bt" ]]; then set_from "$BASE_REV" TO "$p"
  elif [[ -z $bo ]]; then
    set_from "$BASE_REV" TO "$p"
    NOTES+=("expected: $p deleted by us and changed upstream; kept deleted")
  elif [[ -z $bt ]]; then
    set_from "$T" TT "$p"
    NOTES+=("expected: $p changed by us and deleted upstream; deleted")
  else
    show "$P" "$p" "$TMPD/base"; show "$BASE_REV" "$p" "$TMPD/ours"; show "$T" "$p" "$TMPD/theirs"
    rc=0
    git merge-file -p -L ours -L "$PREV" -L "$TAG" "$TMPD/ours" "$TMPD/base" "$TMPD/theirs" >"$TMPD/merged" || rc=$?
    if (( rc == 0 )); then
      cp "$TMPD/merged" "$p"; g add -- "$p"
    elif (( KEEP_GOING )); then
      set_from "$T" TT "$p"
      ATTENTION+=("expected: $p has $rc conflict(s); took upstream's (our change dropped)")
    else
      cp "$TMPD/merged" "$p"
      ATTENTION+=("expected: $p has $rc conflict(s); markers left in the file")
    fi
  fi
  [[ $p == pnpm-workspace.yaml && $(g rev-parse -q --verify ":$p" || true) != "${bo##* }" ]] && WORKSPACE_CHANGED=1
done

# Workflows we disabled (X deleted, X.disabled added): X.disabled gets T's X.
for p in "${DISABLED[@]}"; do
  x=${p%.disabled}
  [[ -n ${TP[$x]:-} && -z ${TO[$x]:-} ]] || continue
  if [[ -n ${TT[$x]:-} ]]; then
    g show "$T:$x" >"$p"; g add -- "$p"
  else
    g rm -q -f -- "$p"
    NOTES+=("workflow: upstream deleted $x; removed $p")
  fi
done

# Rule 5: lock files.
for p in yarn.lock bun.lock; do
  if [[ -n ${TO[$p]:-} || -e $p ]]; then g rm -q -f --ignore-unmatch -- "$p"; rm -f -- "$p"; fi
done
if [[ $(blob TP pnpm-lock.yaml) == "$(blob TT pnpm-lock.yaml)" ]] && (( ! MANIFEST_CHANGED && ! WORKSPACE_CHANGED )); then
  set_from "$BASE_REV" TO pnpm-lock.yaml
  say "rule 5: pnpm-lock.yaml kept (upstream's lock and the manifests did not change)"
else
  set_from "$T" TT pnpm-lock.yaml
  LOCK_REGEN=1
  say "rule 5: pnpm-lock.yaml taken from $TAG; regenerated below"
fi

printf '%s\n' "$TAG" >pacs-ai/UPSTREAM_REF
g add pacs-ai/UPSTREAM_REF

# ---------------------------------------------------------------- patches
step "ledger patches (rule 2)"
PATCH_DIR=$REPO/pacs-ai/patches
patch_files() { sed -n 's#^diff --git a/\(.*\) b/.*#\1#p' "$1" | sort -u; }
shopt -s nullglob
for f in "$PATCH_DIR"/*.patch; do PATCH_NAMES+=("${f##*/}"); done
shopt -u nullglob
if ((${#PATCH_NAMES[@]})); then
  # Status of every patch, applied in order on a clean checkout of the tag.
  "$HERE/apply-patches.sh" --repo "$REPO" --check --onto "$TAGREF" >"$LOG_DIR/patches-check.log" 2>&1 || true
  while read -r status name; do PSTATUS[$name]=$status; done < <(sed -nE '
    s/^applied \(3-way\)[[:space:]]+(.*)$/3way \1/p
    s/^applied[[:space:]]+(.*)$/clean \1/p
    s/^already applied[[:space:]]+(.*)$/upstream \1/p
    s/^CONFLICT[[:space:]]+(.*)$/conflict \1/p' "$LOG_DIR/patches-check.log")
  GOOD=$TMPD/patches-good
  mkdir -p "$GOOD"
  for n in "${PATCH_NAMES[@]}"; do
    st=${PSTATUS[$n]:-conflict}
    if [[ $st == conflict ]] && grep -q '^deleted file mode' "$PATCH_DIR/$n" && ! grep -qE '^(new file mode|\+\+\+ b/)' "$PATCH_DIR/$n"; then
      # An "untrack" patch: the file stays out of git whatever upstream's content.
      mapfile -t fs < <(patch_files "$PATCH_DIR/$n")
      g rm -q -f --cached --ignore-unmatch -- "${fs[@]}"; rm -f -- "${fs[@]}"
      PSTATUS[$n]=untrack
    elif [[ $st != conflict ]]; then
      ln -s "$PATCH_DIR/$n" "$GOOD/$n"
    fi
  done
  rc=0
  "$HERE/apply-patches.sh" --repo "$REPO" --patch-dir "$GOOD" >"$LOG_DIR/patches-apply.log" 2>&1 || rc=$?
  ((rc == 0)) || ATTENTION+=("rule 2: apply-patches.sh failed on the working tree although the patches apply to $TAG (patches-apply.log)")
  declare -A MARKED=()
  for n in "${PATCH_NAMES[@]}"; do
    [[ ${PSTATUS[$n]} == conflict ]] || continue
    mapfile -t fs < <(patch_files "$PATCH_DIR/$n")
    for f in "${fs[@]}"; do MARKED[$f]=1; done
    if (( KEEP_GOING )); then
      ATTENTION+=("rule 2: patch $n does not apply to $TAG; ${fs[*]} left at upstream's version")
    else
      ATTENTION+=("rule 2: patch $n does not apply to $TAG; conflict markers left in ${fs[*]}")
      "$HERE/apply-patches.sh" --repo "$REPO" --patch-dir "$PATCH_DIR" >>"$LOG_DIR/patches-apply.log" 2>&1 || true
      break
    fi
  done
  for p in "${LEDGER_PATHS[@]}"; do
    # Without --keep-going, files with conflict markers stay unmerged for you.
    (( ! KEEP_GOING )) && [[ -n ${MARKED[$p]:-} ]] && continue
    if [[ -e $p ]]; then g add -f -- "$p"; else g rm -q --cached --ignore-unmatch -- "$p"; fi
  done
  # Refresh patches against the tag where it matters (upstream changed one of
  # the files, a three-way apply was needed, or the patch was regenerated).
  for n in "${PATCH_NAMES[@]}"; do
    st=${PSTATUS[$n]}
    [[ $st == conflict || $st == upstream ]] && continue
    mapfile -t fs < <(patch_files "$PATCH_DIR/$n")
    refresh=0
    [[ $st == 3way || $st == untrack ]] && refresh=1
    for f in "${fs[@]}"; do [[ $(blob TP "$f") != "$(blob TT "$f")" ]] && refresh=1; done
    ((refresh)) || continue
    g diff --cached --full-index --no-renames "$TAGREF" -- "${fs[@]}" >"$TMPD/new.patch"
    if [[ -s $TMPD/new.patch ]] && ! cmp -s "$TMPD/new.patch" "$PATCH_DIR/$n"; then
      cp "$TMPD/new.patch" "$PATCH_DIR/$n"; g add -- "$PATCH_DIR/$n"
      PSTATUS[$n]="$st+refreshed"
    fi
  done
  for n in "${PATCH_NAMES[@]}"; do
    case ${PSTATUS[$n]} in
      clean) d="applies cleanly" ;;
      clean+refreshed) d="applies; refreshed against $TAG" ;;
      3way*) d="applied with a three-way merge; refreshed against $TAG" ;;
      untrack*) d="untrack patch regenerated for $TAG" ;;
      upstream) d="already in $TAG: retire this ledger row"; NOTES+=("rule 2: patch $n is already in $TAG; retire its ledger row") ;;
      conflict) d="DOES NOT APPLY" ;;
      *) d=${PSTATUS[$n]} ;;
    esac
    say "  $n: $d"
  done
fi

fi # end of the merge, part 1

# ------------------------------------------------- node runner (container)
NODE_VERSION=$(tr -d '[:space:]v' <.node-version 2>/dev/null || true)
if [[ -z $NODE_VERSION && -f Dockerfile ]]; then
  NODE_VERSION=$(sed -nE 's/^FROM[[:space:]]+node:([0-9][0-9.]*).*/\1/p' Dockerfile | head -n 1)
fi
PNPM_VERSION=$(sed -nE 's/.*"packageManager":[[:space:]]*"pnpm@([0-9][^"+]*).*/\1/p' package.json | head -n 1)
NODE_IMAGE=node:${NODE_VERSION:-24}-slim

# shellcheck disable=SC2016 # expanded inside the container
NODE_PRELUDE='set -e
mkdir -p "$HOME"
if ls /extra-ca/*.crt >/dev/null 2>&1; then
  node -e "process.stdout.write(require(\"tls\").rootCertificates.join(\"\n\") + \"\n\")" >"$HOME/ca-bundle.pem"
  cat /extra-ca/*.crt >>"$HOME/ca-bundle.pem"
  export NODE_EXTRA_CA_CERTS=$HOME/ca-bundle.pem npm_config_cafile=$HOME/ca-bundle.pem
fi
cli=/cache/pnpm-cli/$PNPM_VERSION
if [ ! -x "$cli/node_modules/.bin/pnpm" ]; then
  npm install --prefix "$cli" --no-audit --no-fund --loglevel=error "pnpm@$PNPM_VERSION" >/dev/null
fi
export PATH=$cli/node_modules/.bin:$PATH npm_config_store_dir=/cache/pnpm-store
set +e
'
# run_node NAME COMMAND: run COMMAND (bash) in the repository with Node and
# pnpm; output to <log dir>/NAME.log; returns the command's status.
run_node() {
  local name=$1 cmd=$2 ca=() rc=0
  if (( USE_DOCKER )); then
    mkdir -p "$CACHE_DIR"
    compgen -G "$REPO/pacs-ai/docker/ca-certificates/*.crt" >/dev/null &&
      ca=(-v "$REPO/pacs-ai/docker/ca-certificates:/extra-ca:ro")
    docker run --rm --init --user "$(id -u):$(id -g)" \
      -e HOME=/cache/home -e CI=true -e QUICK_BUILD=true -e APP_CONFIG=config/pacs-ai.js \
      -e PNPM_VERSION="$PNPM_VERSION" \
      -v "$CACHE_DIR:/cache" -v "$REPO:$REPO" "${ca[@]}" -w "$REPO" \
      "$NODE_IMAGE" bash -c "$NODE_PRELUDE$cmd" >"$LOG_DIR/$name.log" 2>&1 || rc=$?
  else
    (cd "$REPO" && CI=true QUICK_BUILD=true APP_CONFIG=config/pacs-ai.js bash -c "$cmd") \
      >"$LOG_DIR/$name.log" 2>&1 || rc=$?
  fi
  return "$rc"
}
STORE_ARG=""
(( USE_DOCKER )) && STORE_ARG="--store-dir /cache/pnpm-store"

summary_counts() {
  local r
  for r in "${RULE_KEYS[@]}"; do
    printf -- '%-46s %5d path(s), %4d git conflict(s)\n' "$(rule_label "$r")" "${SET_BY_RULE[$r]:-0}" "${CONFLICTS_BY_RULE[$r]:-0}"
  done
}

if (( ! CHECKS_ONLY )); then # the merge, part 2
if (( LOCK_REGEN )); then
  if (( NO_CHECKS )); then
    ATTENTION+=("rule 5: pnpm-lock.yaml is upstream's and was not regenerated (--no-checks)")
  else
    say "regenerating pnpm-lock.yaml (node $NODE_VERSION, pnpm $PNPM_VERSION)"
    if run_node lockfile "pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts $STORE_ARG"; then
      g add pnpm-lock.yaml
    else
      ATTENTION+=("rule 5: pnpm install --lockfile-only failed (lockfile.log); pnpm-lock.yaml is upstream's")
      g add pnpm-lock.yaml
    fi
  fi
fi

# ------------------------------------------------------------------ commit
step "commit"
REMAINING=$(g ls-files -u | cut -f2 | sort -u)
if [[ -n $REMAINING ]]; then
  while IFS= read -r p; do ATTENTION+=("unresolved: $p"); done <<<"$REMAINING"
fi

if ((${#ATTENTION[@]})) && (( ! KEEP_GOING )); then
  say "stopping before the commit: ${#ATTENTION[@]} item(s) need a person (see the summary)"
  STOPPED=before-commit
elif (( DRY_RUN )); then
  say "dry run: merge resolved and staged, not committed"
elif (( ! MERGING )) && g diff --cached --quiet; then
  say "nothing to commit: $TAG is already merged and every rule leaves the base unchanged"
else
  {
    if (( MERGING )); then echo "Merge OHIF $TAG (upgrade-ohif.sh)"; else echo "Re-apply the upgrade rules for OHIF $TAG (upgrade-ohif.sh)"; fi
    echo
    echo "Upstream $PREV -> $TAG (${T:0:12}); rules of docs/ohif-upgrade/PLAN.md 9 (P3.1)."
    echo "git conflicts: ${#UNMERGED[@]}."
    summary_counts
    ((${#ATTENTION[@]})) && { echo; echo "Kept upstream's side (--keep-going):"; printf -- '- %s\n' "${ATTENTION[@]}"; }
    ((${#LOST[@]})) && { echo; echo "Our edits dropped by rule 8:"; printf -- '- %s\n' "${LOST[@]}"; }
  } >"$TMPD/msg"
  g commit -q --no-verify -F "$TMPD/msg"
  COMMITTED=$(g rev-parse HEAD)
  say "committed ${COMMITTED:0:12} ($(g rev-list --parents -n 1 HEAD | awk '{print NF-1}') parent(s))"
fi
restore_env
[[ -n $ENV_NOTE ]] && say "$ENV_NOTE"
else
  step "upgrade-ohif --checks-only: $TAG"
  say "working tree of $REPO ($(g rev-parse --short HEAD), branch $(g symbolic-ref -q --short HEAD || echo detached))"
  say "logs:     $LOG_DIR"
fi # end of the merge, part 2

# ------------------------------------------------------------------ checks
declare -A CHECK=() CHECK_TIME=()
CHECK_ORDER=(patches-fresh drift install build lint-imports unit-tests)
(( TYPECHECK )) && CHECK_ORDER+=(typecheck)
for c in "${CHECK_ORDER[@]}"; do CHECK[$c]="not run"; done

run_check() {
  local name=$1; shift
  local start rc=0
  start=$(date +%s)
  say "check $name ..."
  "$@" || rc=$?
  CHECK_TIME[$name]=$(( $(date +%s) - start ))
  if ((rc == 0)); then CHECK[$name]=pass; else CHECK[$name]="FAIL (exit $rc, $name.log)"; FAILED+=("$name"); fi
  say "  ${CHECK[$name]} (${CHECK_TIME[$name]}s)"
  return "$rc"
}
# shellcheck disable=SC2329 # the check_* functions are called through run_check
check_patches() { "$HERE/apply-patches.sh" --repo "$REPO" --fresh --check >"$LOG_DIR/patches-fresh.log" 2>&1; }
# shellcheck disable=SC2329
check_drift() {
  "$HERE/check-upstream-drift.sh" --repo "$REPO" --enforce --forbid-ohif-ui --markdown "$LOG_DIR/drift.md" \
    >"$LOG_DIR/drift.log" 2>&1
}
# shellcheck disable=SC2329,SC2016
check_typecheck() {
  run_node typecheck '
for d in extensions/pacs-ai-* modes/pacs-ai; do
  [ -f "$d/tsconfig.json" ] || continue
  out=$(node_modules/.bin/tsc --noEmit --emitDeclarationOnly false -p "$d/tsconfig.json" 2>&1)
  total=$(printf "%s\n" "$out" | grep -c "error TS")
  own=$(printf "%s\n" "$out" | grep "error TS" | grep -c "^$d/")
  printf "TYPECHECK %s %s %s\n" "$d" "$total" "$own"
  printf "%s\n" "$out" | grep "error TS" | grep "^$d/" | head -n 200
done'
}

stop_now() { (( ! KEEP_GOING )) && ((${#FAILED[@]})); }
if [[ $STOPPED == before-commit ]]; then
  for c in "${CHECK_ORDER[@]}"; do CHECK[$c]="skipped (merge not committed)"; done
elif (( NO_CHECKS )); then
  for c in "${CHECK_ORDER[@]}"; do CHECK[$c]="skipped (--no-checks)"; done
else
  step "checks (node $NODE_VERSION in $( ((USE_DOCKER)) && echo "$NODE_IMAGE" || echo 'this machine'), pnpm $PNPM_VERSION)"
  run_check patches-fresh check_patches || true
  stop_now || run_check drift check_drift || true
  if ! stop_now; then
    if run_check install run_node install "pnpm install --frozen-lockfile $STORE_ARG"; then
      if (( NO_BUILD )); then CHECK[build]="skipped (--no-build)"
      else stop_now || run_check build run_node build "pnpm run build" || true
      fi
      stop_now || run_check lint-imports run_node lint-imports "bash pacs-ai/scripts/lint-imports.sh" || true
      stop_now || run_check unit-tests run_node unit-tests "pnpm -r --no-bail --no-sort run test:unit:ci" || true
      if (( TYPECHECK )); then stop_now || run_check typecheck check_typecheck || true; fi
    else
      for c in build lint-imports unit-tests typecheck; do [[ -n ${CHECK[$c]:-} ]] && CHECK[$c]="skipped (install failed)"; done
    fi
  fi
  for c in "${CHECK_ORDER[@]}"; do
    [[ ${CHECK[$c]} == "not run" ]] && CHECK[$c]="skipped (stopped after a failure)"
  done
fi

# ----------------------------------------------------------------- summary
tests_line() {
  [[ -f $LOG_DIR/unit-tests.log ]] || return 0
  sed 's/\x1b\[[0-9;]*m//g' "$LOG_DIR/unit-tests.log" | awk '
    /Test Suites:/ { runs++; if (/failed/) { bad++; sub(/ test:unit:ci: Test Suites:.*/, ""); failing = failing " " $0 } }
    /Tests:/ { for (i = 1; i <= NF; i++) { if ($(i+1) ~ /^failed/) tf += $i; if ($(i+1) ~ /^passed/) tp += $i } }
    /ERR_PNPM|Command failed/ { err = 1 }
    END {
      printf "unit tests: %d package run(s), %d test(s) passed, %d failed", runs, tp, tf
      if (bad) printf "; failing packages:%s", failing
      if (err && !bad) printf "; pnpm reported an error (see unit-tests.log)"
      printf "\n"
    }'
  # Packages with a test:unit:ci script that printed nothing (did not start).
  local f d missing=()
  while IFS= read -r f; do
    grep -q '"test:unit:ci"' "$f" 2>/dev/null || continue
    d=${f%/package.json}
    grep -q "^$d test:unit:ci:" "$LOG_DIR/unit-tests.log" || missing+=("$d")
  done < <(g ls-files 'extensions/*/package.json' 'modes/*/package.json' 'platform/*/package.json')
  if ((${#missing[@]})); then echo "unit tests that did not run: ${missing[*]}"; fi
}
SUMMARY=$LOG_DIR/summary.txt
{
if (( CHECKS_ONLY )); then
  echo "upgrade-ohif --checks-only: $(g symbolic-ref -q --short HEAD || echo detached) @ $(g rev-parse --short HEAD), UPSTREAM_REF $TAG"
else
  echo "upgrade-ohif summary: $PREV -> $TAG"
  echo "branch $BRANCH from $BASE (${BASE_REV:0:12}); upstream ${T:0:12}"
  if [[ -n $COMMITTED ]]; then echo "commit ${COMMITTED:0:12} ($(g rev-list --parents -n 1 "$COMMITTED" | awk '{print NF-1}') parent(s))"
  elif [[ $STOPPED == before-commit ]]; then echo "NOT COMMITTED: the merge is staged on $BRANCH for you to finish"
  elif (( DRY_RUN )); then echo "dry run: staged on $BRANCH, not committed"
  else echo "no commit (nothing changed)"
  fi
  echo
  echo "git merge: ${#UNMERGED[@]} conflicted path(s); ${#PATHS[@]} path(s) differ between $PREV, base and $TAG"
  echo "conflicts and paths set, by rule:"
  summary_counts | sed 's/^/  /'
  echo "  clean git merges reset to upstream (rule 8): $AUTO_RESET"
  echo "  lock file: $( ((LOCK_REGEN)) && echo "taken from $TAG and regenerated" || echo kept)"
  echo
  echo "ledger patches:"
  if ((${#PATCH_NAMES[@]})); then
    for n in "${PATCH_NAMES[@]}"; do printf '  %-44s %s\n' "$n" "${PSTATUS[$n]}"; done
  else
    echo "  (none)"
  fi
  echo
  echo "needs a person (${#ATTENTION[@]}):"
  ((${#ATTENTION[@]})) && printf '  %s\n' "${ATTENTION[@]}" || echo "  (none)"
  echo "our edits dropped by rule 8 (${#LOST[@]}):"
  ((${#LOST[@]})) && printf '  %s\n' "${LOST[@]}" || echo "  (none)"
  if ((${#NOTES[@]})); then echo "notes:"; printf '  %s\n' "${NOTES[@]}"; fi
fi
  echo
  echo "checks:"
  for c in "${CHECK_ORDER[@]}"; do
    printf '  %-14s %s%s\n' "$c" "${CHECK[$c]}" "${CHECK_TIME[$c]:+ (${CHECK_TIME[$c]}s)}"
  done
  [[ -f $LOG_DIR/drift.log ]] && sed -nE 's/^(modified upstream files|unexplained files|ledger rows|import-direction violations):[[:space:]]+/  drift \1: /p' "$LOG_DIR/drift.log"
  tests_line | sed 's/^/  /'
  if [[ -f $LOG_DIR/typecheck.log ]]; then
    echo "  tsc errors (package: total / in its own files):"
    sed -nE 's/^TYPECHECK ([^ ]+) ([0-9]+) ([0-9]+)$/    \1: \2 \/ \3/p' "$LOG_DIR/typecheck.log"
  fi
  echo
  echo "logs: $LOG_DIR"
  if (( ! CHECKS_ONLY )) && [[ -n $COMMITTED || $STOPPED == before-commit || $DRY_RUN == 1 ]]; then
    echo "to throw this away: git merge --abort 2>/dev/null; git switch <your branch>; git branch -D $BRANCH"
  fi
} >"$SUMMARY"

# Markdown version (for $GITHUB_STEP_SUMMARY).
{
  if (( CHECKS_ONLY )); then
    echo "## upgrade-ohif checks (\`$TAG\`)"
  else
    echo "## OHIF upgrade: \`$PREV\` → \`$TAG\`"
    echo
    echo "Base \`${BASE_REV:0:12}\`, upstream \`${T:0:12}\`, ${#UNMERGED[@]} git conflict(s), ${#ATTENTION[@]} item(s) for a person."
    echo
    echo "| Rule | Paths | Git conflicts |"
    echo "|---|---:|---:|"
    for r in "${RULE_KEYS[@]}"; do echo "| $(rule_label "$r") | ${SET_BY_RULE[$r]:-0} | ${CONFLICTS_BY_RULE[$r]:-0} |"; done
  fi
  echo
  echo "| Check | Result |"
  echo "|---|---|"
  for c in "${CHECK_ORDER[@]}"; do echo "| $c | ${CHECK[$c]}${CHECK_TIME[$c]:+ (${CHECK_TIME[$c]}s)} |"; done
  echo
  echo "<details><summary>Full summary</summary>"
  echo
  echo '```'
  cat "$SUMMARY"
  echo '```'
  echo "</details>"
  for c in "${FAILED[@]}"; do
    echo
    echo "<details><summary>$c: last 60 log lines</summary>"
    echo
    echo '```'
    tail -n 60 "$LOG_DIR/$c.log" 2>/dev/null | sed 's/\x1b\[[0-9;]*m//g'
    echo '```'
    echo "</details>"
  done
} >"$LOG_DIR/summary.md"

say ""
tee -a "$RUN_LOG" <"$SUMMARY"
if ((${#ATTENTION[@]} || ${#FAILED[@]})); then exit 1; fi
exit 0
