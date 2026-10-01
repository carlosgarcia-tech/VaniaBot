#!/bin/bash
#
# Limpieza de tags obsoletos del paquete ghcr.io/carlosgarcia-tech/vaniabot
#
# Uso:
#   GH_TOKEN=ghp_xxx bash clean-ghcr-tags.sh            # dry-run: solo lista
#   GH_TOKEN=ghp_xxx bash clean-ghcr-tags.sh --apply    # borra de verdad
#
# El token necesita permiso de escritura sobre GitHub Packages (classic PAT
# con delete:packages, o fine-grained PAT con Packages: write).
#
# Clasificacion por version de paquete (cada version = un digest con unos
# tags asociados):
#   CONSERVAR : alguna tag en la convencion vigente: 7.1.x, 7.1, 7, latest.
#   BASURA    : solo tags con prefijo v (v7.1.2, v4.11.0...), solo digitos
#               sueltos (1, 6, 12...) o solo alias viejos sin v (7.0.1,
#               6.12.11, 6.12.12...).
#   NO TOCAR  : cualquier otra cosa (main-*, lts-*, mixtas...).
#
# OJO: si una version BASURA comparte digest con una CONSERVADA (ghcr no
# permite borrar tags por separado), se omite y se avisa: borrarla tambien
# eliminaria las tags que se quieren conservar.

set -euo pipefail

APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

: "${GH_TOKEN:?Define GH_TOKEN (token con permiso de escritura de Packages)}"

python3 - "$APPLY" "$GH_TOKEN" <<'PYEOF'
import json
import re
import sys
import urllib.error
import urllib.request

apply_mode = sys.argv[1] == "True"
token = sys.argv[2]
OWNER, NAME = "carlosgarcia-tech", "vaniabot"
BASE = f"https://api.github.com/users/{OWNER}/packages/container/{NAME}"

def api(path, method="GET"):
    req = urllib.request.Request(
        BASE + path,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "vaniabot-cleanup",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read()
            return r.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        print(f"ERROR HTTP {e.code} en {method} {path}: {e.read().decode()[:200]}")
        if e.code == 401:
            print("El token no es valido o no tiene permiso de Packages.")
        sys.exit(1)

# ── Listar todas las versiones (paginado) ────────────────────────────────────
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
    item = {"id": v["id"], "tags": tags or ["(sin tags)"], "digest": digest}
    if any(keep_re.match(t) for t in tags):
        kept.append(item)
    elif any(t.startswith("v") for t in tags) or all(digit_re.match(t) for t in tags) \
            or (tags and all(semver_re.match(t) for t in tags)):
        garbage.append(item)
    else:
        other.append(item)

kept_digests = {i["digest"] for i in kept}

print(f"Versiones del paquete: {len(versions)} "
      f"(conservar {len(kept)} | basura {len(garbage)} | no tocar {len(other)})\n")

print("== CONSERVAR ==")
for i in kept:
    print(f"  id={i['id']:<10} {', '.join(i['tags'])}")

if other:
    print("\n== NO TOCAR (fuera de alcance) ==")
    for i in other:
        print(f"  id={i['id']:<10} {', '.join(i['tags'])}")

print("\n== BASURA candidata a borrado ==")
deletable = []
for i in garbage:
    conflict = i["digest"] in kept_digests
    flag = "  [OMITIDA: comparte digest con una version conservada]" if conflict else ""
    print(f"  id={i['id']:<10} {', '.join(i['tags'])}{flag}")
    if not conflict:
        deletable.append(i)

print(f"\nBorrables sin conflicto: {len(deletable)} de {len(garbage)}")

if not apply_mode:
    print("\nDRY-RUN: no se ha borrado nada. Revisa la lista y ejecuta con --apply.")
    sys.exit(0)

if not deletable:
    print("Nada que borrar.")
    sys.exit(0)

print(f"\n--apply: borrando {len(deletable)} versiones...")
for i in deletable:
    status, _ = api(f"/versions/{i['id']}", method="DELETE")
    print(f"  borrada id={i['id']} ({', '.join(i['tags'])}) -> HTTP {status}")

print("\nListo. Las tags de las versiones borradas ya no estan en ghcr.io.")
PYEOF
