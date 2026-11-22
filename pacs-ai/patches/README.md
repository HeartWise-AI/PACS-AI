# Ledger patches

One `.patch` file per row of `pacs-ai/UPSTREAM_PATCHES.md`.

- Name: `NNNN-short-name.patch` (four digits); `apply-patches.sh` applies the
  files in that order.
- Create against the pinned upstream ref so `git apply --3way` can fall back to
  a three-way merge:

  ```bash
  tag=$(cat pacs-ai/UPSTREAM_REF)
  git diff --full-index "refs/upstream/$tag" HEAD -- <file> > pacs-ai/patches/NNNN-short-name.patch
  ```

- Check that every patch applies to a fresh upstream checkout:
  `pacs-ai/scripts/apply-patches.sh --fresh --check`.
