#!/usr/bin/env bash
# apply-patches.sh: apply the ledger patches (pacs-ai/patches/*.patch) in
# file-name order. See docs/ohif-upgrade/PLAN.md 6.2 rule 3.
#
# Usage:
#   pacs-ai/scripts/apply-patches.sh [--check] [--fresh | --onto REF [--keep]] [options]
#
# Targets:
#   (default)    the working tree of the repository
#   --fresh      a temporary detached worktree of refs/upstream/<tag>, where
#                <tag> is read from pacs-ai/UPSTREAM_REF (fetched with
#                --no-tags from UPSTREAM_URL if missing)
#   --onto REF   a temporary detached worktree of REF
#   --keep       keep the temporary worktree and print its path
#
# Modes:
#   (default)    apply each patch that is not applied yet; a patch that does
#                not apply cleanly is retried with `git apply --3way`; on a
#                conflict the script stops, names the patch and the files, and
#                exits 1. Patches already applied are skipped, so running it
#                twice is safe.
#   --check      change nothing in the target: report for each patch whether
#                it is already applied, applies cleanly, or conflicts; exit 1
#                if any conflicts. On a temporary worktree (--fresh, --onto)
#                the patches are applied there in order, so later patches are
#                checked on top of earlier ones; on the working tree each patch
#                is checked on its own.
#
# Options:
#   --repo DIR        repository (default: the one holding this script)
#   --patch-dir DIR   patch directory (default: <repo>/pacs-ai/patches)
#   -h, --help        show this help
#
# Exit status: 0 success, 1 conflict, 2 usage or setup error.

set -euo pipefail
export LC_ALL=C

usage() { sed -n '2,/^$/s/^# \{0,1\}//p' "$0"; }
die() { echo "apply-patches: $*" >&2; exit 2; }

CHECK=0
FRESH=0
ONTO=""
KEEP=0
REPO=""
PATCH_DIR=""
UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/OHIF/Viewers.git}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) CHECK=1 ;;
    --fresh) FRESH=1 ;;
    --onto) [[ $# -ge 2 ]] || die "--onto needs a value"; ONTO=$2; shift ;;
    --keep) KEEP=1 ;;
    --repo) [[ $# -ge 2 ]] || die "--repo needs a value"; REPO=$2; shift ;;
    --patch-dir) [[ $# -ge 2 ]] || die "--patch-dir needs a value"; PATCH_DIR=$2; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
  shift
done
[[ $FRESH == 1 && -n $ONTO ]] && die "use either --fresh or --onto, not both"

if [[ -z $REPO ]]; then
  REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")" && git rev-parse --show-toplevel) \
    || die "cannot find the repository holding this script; use --repo"
fi
REPO=$(cd "$REPO" && git rev-parse --show-toplevel) || die "$REPO is not a git repository"
PATCH_DIR=${PATCH_DIR:-$REPO/pacs-ai/patches}
PATCH_DIR=$(cd "$PATCH_DIR" 2>/dev/null && pwd) || die "patch directory not found: $PATCH_DIR"

shopt -s nullglob
PATCHES=("$PATCH_DIR"/*.patch)
shopt -u nullglob
if [[ ${#PATCHES[@]} -eq 0 ]]; then
  echo "apply-patches: no patches in ${PATCH_DIR#"$REPO/"}; nothing to do"
  exit 0
fi

# ------------------------------------------------------------------ target
TARGET=$REPO
TMP_WT=""
# shellcheck disable=SC2329 # invoked by the EXIT trap
cleanup() {
  if [[ -n $TMP_WT && $KEEP == 0 ]]; then
    git -C "$REPO" worktree remove --force "$TMP_WT" >/dev/null 2>&1 || rm -rf "$TMP_WT"
    git -C "$REPO" worktree prune >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ $FRESH == 1 ]]; then
  [[ -f $REPO/pacs-ai/UPSTREAM_REF ]] || die "pacs-ai/UPSTREAM_REF not found"
  tag=$(tr -d '[:space:]' <"$REPO/pacs-ai/UPSTREAM_REF")
  [[ $tag =~ ^[A-Za-z0-9._-]+$ ]] || die "pacs-ai/UPSTREAM_REF holds an invalid tag: $tag"
  ONTO="refs/upstream/$tag"
  if ! git -C "$REPO" rev-parse -q --verify "$ONTO^{commit}" >/dev/null; then
    echo "apply-patches: $ONTO missing; fetching tag $tag" >&2
    git -C "$REPO" fetch --no-tags --quiet "$UPSTREAM_URL" "+refs/tags/$tag:$ONTO" >&2 \
      || die "could not fetch tag $tag from $UPSTREAM_URL"
  fi
fi
if [[ -n $ONTO ]]; then
  base=$(git -C "$REPO" rev-parse -q --verify "$ONTO^{commit}") || die "$ONTO is not a commit"
  TMP_WT=$(mktemp -d "${TMPDIR:-/tmp}/apply-patches.XXXXXX")
  git -C "$REPO" worktree add --detach --quiet "$TMP_WT" "$base" \
    || die "could not check out $ONTO into $TMP_WT"
  TARGET=$TMP_WT
  echo "apply-patches: target is a fresh checkout of $ONTO (${base:0:12})"
else
  echo "apply-patches: target is the working tree of $REPO"
fi
# On a throwaway worktree a check may apply for real.
APPLY_FOR_REAL=1
[[ $CHECK == 1 && -z $TMP_WT ]] && APPLY_FOR_REAL=0

# ------------------------------------------------------------------- apply
n_applied=0 n_skipped=0 n_conflict=0
for patch in "${PATCHES[@]}"; do
  name=${patch##*/}
  if git -C "$TARGET" apply --check "$patch" >/dev/null 2>&1; then
    if [[ $APPLY_FOR_REAL == 1 ]]; then
      git -C "$TARGET" apply "$patch"
      echo "applied          $name"
    else
      echo "applies cleanly  $name"
    fi
    n_applied=$((n_applied + 1))
  elif git -C "$TARGET" apply --check --reverse "$patch" >/dev/null 2>&1; then
    echo "already applied  $name"
    n_skipped=$((n_skipped + 1))
  elif [[ $APPLY_FOR_REAL == 1 ]] && out=$(git -C "$TARGET" apply --3way "$patch" 2>&1); then
    echo "applied (3-way)  $name"
    n_applied=$((n_applied + 1))
  else
    n_conflict=$((n_conflict + 1))
    [[ ${out:-} ]] || out=$(git -C "$TARGET" apply --check "$patch" 2>&1 || true)
    echo "CONFLICT         $name" >&2
    printf '%s\n' "$out" | sed 's/^/    /' >&2
    unmerged=$(git -C "$TARGET" diff --name-only --diff-filter=U 2>/dev/null || true)
    if [[ -n $unmerged ]]; then
      echo "    files with conflict markers:" >&2
      printf '%s\n' "$unmerged" | sed 's/^/      /' >&2
    fi
    if [[ $CHECK == 0 ]]; then
      [[ -n $TMP_WT ]] && KEEP=1 && echo "    worktree kept for inspection: $TMP_WT" >&2
      echo "apply-patches: stopped at $name; resolve it, then run again" >&2
      exit 1
    fi
  fi
  out=""
done

echo "apply-patches: ${#PATCHES[@]} patch(es): $n_applied applied or applicable, $n_skipped already applied, $n_conflict conflict(s)"
[[ $KEEP == 1 && -n $TMP_WT ]] && echo "apply-patches: worktree kept at $TMP_WT"
[[ $n_conflict -eq 0 ]] || exit 1
exit 0
