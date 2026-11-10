#!/bin/bash
#
# Cleanup of stale tags of the ghcr.io/carlosgarcia-tech/orbit package
#
# Usage:
#   GH_TOKEN=ghp_xxx bash clean-ghcr-tags.sh            # dry-run: list only
#   GH_TOKEN=ghp_xxx bash clean-ghcr-tags.sh --apply    # actually deletes
#
# The token needs write permission on GitHub Packages (classic PAT with
# delete:packages, or fine-grained PAT with Packages: write).
#
# Classification by package version (each version = one digest with its
# associated tags):
#   KEEP     : some tag in the current convention: 7.1.x, 7.1, 7, latest.
#   GARBAGE  : only tags with the v prefix (v7.1.2, v4.11.0...), only loose
#              digits (1, 6, 12...) or only old aliases without v (7.0.1,
#              6.12.11, 6.12.12...).
#   NO TOUCH : anything else (main-*, lts-*, mixed...).
#
# NOTE: if a GARBAGE version shares a digest with a KEPT one (ghcr does
# not allow deleting tags separately), it is skipped and reported: deleting
# it too would remove tags that should be kept.

set -euo pipefail

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

: "${GH_TOKEN:?Set GH_TOKEN (token with Packages write permission)}"

python3 - "$APPLY" "$GH_TOKEN" <<'PYEOF'
import json
import re
import sys
import urllib.error
import urllib.request

apply_mode = sys.argv[1] == "True"
token = sys.argv[2]
OWNER, NAME = "carlosgarcia-tech", "orbit"
BASE = f"https://api.github.com/users/{OWNER}/packages/container/{NAME}"

def api(path, method="GET"):
    req = urllib.request.Request(
        BASE + path,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "orbit-cleanup",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            return r.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code} on {method} {path}: {e.read().decode()[:200]}")
        if e.code == 401:
            print("The token is invalid or lacks Packages permission.")
        sys.exit(1)

versions, page = [], 1
while page <= 20:
    status, batch = api(f"/versions?per_page=100&page={page}")
    if not batch:
        break
    versions.extend(batch)
    page += 1

keep_re = re.compile(r"^(7\.1\.\d+|7\.1|7|latest)$")
digit_re = re.compile(r"^\d+$")
semver_re = re.compile(r"^\d+\.\d+\.\d+$")

kept, garbage, other = [], [], []
for v in versions:
    tags = v.get("metadata", {}).get("container", {}).get("tags", [])
    digest = v.get("name", "?")
    item = {"id": v["id"], "tags": tags or ["(no tags)"], "digest": digest}
    if any(keep_re.match(t) for t in tags):
        kept.append(item)
    elif any(t.startswith("v") for t in tags) or all(digit_re.match(t) for t in tags) \
            or (tags and all(semver_re.match(t) for t in tags)):
        garbage.append(item)
    else:
        other.append(item)

kept_digests = {i["digest"] for i in kept}

print(f"Package versions: {len(versions)} "
      f"(keep {len(kept)} | garbage {len(garbage)} | no touch {len(other)})\n")

print("== KEEP ==")
for i in kept:
    print(f"  id={i['id']:<10} {', '.join(i['tags'])}")

if other:
    print("\n== NO TOUCH (out of scope) ==")
    for i in other:
        print(f"  id={i['id']:<10} {', '.join(i['tags'])}")

print("\n== GARBAGE deletion candidates ==")
deletable = []
for i in garbage:
    conflict = i["digest"] in kept_digests
    flag = "  [SKIPPED: shares a digest with a kept version]" if conflict else ""
    print(f"  id={i['id']:<10} {', '.join(i['tags'])}{flag}")
    if not conflict:
        deletable.append(i)

print(f"\nDeletable without conflict: {len(deletable)} of {len(garbage)}")

if not apply_mode:
    print("\nDRY-RUN: nothing was deleted. Review the list and run with --apply.")
    sys.exit(0)

if not deletable:
    print("Nothing to delete.")
    sys.exit(0)

print(f"\n--apply: deleting {len(deletable)} versions...")
for i in deletable:
    status, _ = api(f"/versions/{i['id']}", method="DELETE")
    print(f"  deleted id={i['id']} ({', '.join(i['tags'])}) -> HTTP {status}")

print("\nDone. The deleted version tags are no longer on ghcr.io.")
PYEOF
