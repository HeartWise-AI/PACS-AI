#!/usr/bin/env python3
"""merge-manifest.py: three-way merge of a JSON manifest for upgrade-ohif.sh.

PLAN.md 9, P3.1 rule 4: package.json (root, app) and pluginConfig.json take
upstream's new version, then get our entries back. "Our entries" are the
differences between the previous upstream tag (BASE) and our branch (OURS);
they are replayed on the new upstream tag (THEIRS):

  - a value we did not change takes upstream's (new) value;
  - a value upstream did not change keeps ours;
  - keys we added are inserted after the key that precedes them in OURS
    (at the start when none does); keys we removed stay removed unless
    upstream changed them (then upstream wins: conflict);
  - objects are merged key by key, recursively;
  - lists of objects that all carry a "packageName" (pluginConfig.json) are
    merged like objects keyed by packageName, keeping upstream's order;
  - lists of strings or numbers are merged as ordered sets;
  - anything else that both sides changed differently is a conflict:
    upstream's value is kept and the conflict is reported.

Output: THEIRS's text when the result equals THEIRS, OURS's text when it
equals OURS, otherwise JSON with two-space indentation (the format of
OHIF's manifests).

Usage: merge-manifest.py BASE OURS THEIRS -o OUT [--label NAME]
Prints one line per conflict ("conflict<TAB>path<TAB>ours=..<TAB>upstream=..")
and a final "merged ..." line. Exit status: 0 merged, 1 merged with
conflicts (OUT holds upstream's values there), 2 usage or parse error.
"""
import argparse
import json
import sys

MISSING = object()
LIST_KEY = 'packageName'


def dump(v):
    if v is MISSING:
        return '<absent>'
    s = json.dumps(v, ensure_ascii=False, sort_keys=True)
    return s if len(s) <= 200 else s[:197] + '...'


class Merger:
    def __init__(self):
        self.conflicts = []
        self.ours_kept = 0

    def conflict(self, path, ours, theirs):
        self.conflicts.append((path, ours, theirs))

    def merge(self, base, ours, theirs, path):
        if ours == theirs:
            return ours
        if equal(ours, base):
            return theirs
        if equal(theirs, base):
            self.ours_kept += 1
            return ours
        if isinstance(ours, dict) and isinstance(theirs, dict):
            return self.merge_dict(base if isinstance(base, dict) else {}, ours, theirs, path)
        if isinstance(ours, list) and isinstance(theirs, list):
            b = base if isinstance(base, list) else []
            if all(keyed(x) for x in b + ours + theirs):
                return self.merge_keyed_list(b, ours, theirs, path)
            if all(scalar(x) for x in b + ours + theirs):
                return self.merge_set_list(b, ours, theirs)
        self.conflict(path, ours, theirs)
        return theirs

    def merge_dict(self, base, ours, theirs, path):
        out = {}
        for k in theirs:
            v = self.merge(base.get(k, MISSING), ours.get(k, MISSING), theirs[k], path + [k])
            if v is not MISSING:
                out[k] = v
        added = [k for k in ours if k not in theirs]
        for k in added:
            v = self.merge(base.get(k, MISSING), ours[k], MISSING, path + [k])
            if v is not MISSING:
                out = insert_after(out, list(ours), k, v)
        return out

    def merge_keyed_list(self, base, ours, theirs, path):
        b = {x[LIST_KEY]: x for x in base}
        o = {x[LIST_KEY]: x for x in ours}
        t = {x[LIST_KEY]: x for x in theirs}
        out = {}
        for k, tv in t.items():
            v = self.merge(b.get(k, MISSING), o.get(k, MISSING), tv, path + [k])
            if v is not MISSING:
                out[k] = v
        for k, ov in o.items():
            if k in t:
                continue
            v = self.merge(b.get(k, MISSING), ov, MISSING, path + [k])
            if v is not MISSING:
                out = insert_after(out, list(o), k, v)
        return list(out.values())

    def merge_set_list(self, base, ours, theirs):
        removed = [x for x in base if x not in ours]
        out = [x for x in theirs if x not in removed]
        for i, x in enumerate(ours):
            if x in base or x in out:
                continue
            prev = [y for y in ours[:i] if y in out]
            pos = out.index(prev[-1]) + 1 if prev else 0
            out.insert(pos, x)
            self.ours_kept += 1
        return out


def equal(a, b):
    return a is b if (a is MISSING or b is MISSING) else a == b


def keyed(x):
    return isinstance(x, dict) and isinstance(x.get(LIST_KEY), str)


def scalar(x):
    return isinstance(x, (str, int, float)) and not isinstance(x, bool)


def insert_after(d, order, key, value):
    """Insert key after the closest key preceding it in `order` that d holds."""
    idx = order.index(key)
    prev = next((k for k in reversed(order[:idx]) if k in d), None)
    items = list(d.items())
    pos = 0 if prev is None else [k for k, _ in items].index(prev) + 1
    items.insert(pos, (key, value))
    return dict(items)


def load(path):
    with open(path, encoding='utf-8') as f:
        text = f.read()
    return text, json.loads(text)


def main():
    ap = argparse.ArgumentParser(description='three-way JSON manifest merge')
    ap.add_argument('base')
    ap.add_argument('ours')
    ap.add_argument('theirs')
    ap.add_argument('-o', '--output', required=True)
    ap.add_argument('--label', default='')
    a = ap.parse_args()
    try:
        _, base = load(a.base)
        ours_text, ours = load(a.ours)
        theirs_text, theirs = load(a.theirs)
    except (OSError, ValueError) as e:
        print(f'merge-manifest: {e}', file=sys.stderr)
        return 2
    m = Merger()
    result = m.merge(base, ours, theirs, [])
    if result == theirs:
        text = theirs_text
    elif result == ours:
        text = ours_text
    else:
        text = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    with open(a.output, 'w', encoding='utf-8') as f:
        f.write(text)
    label = a.label or a.ours
    for path, o, t in m.conflicts:
        p = '.'.join(str(x) for x in path) or '(root)'
        print(f'conflict\t{label}: {p}\tours={dump(o)}\tupstream={dump(t)} (kept)')
    print(f'merged {label}: {m.ours_kept} change(s) of ours replayed, {len(m.conflicts)} conflict(s)')
    return 1 if m.conflicts else 0


if __name__ == '__main__':
    sys.exit(main())
