#!/usr/bin/env python3
"""One-shot documentation header generator for VaniaBot src.

For every .ts file under src without an '@author' header:
- command classes (extends Command): header built from their own
  name/description/usage/category fields, plus a one-line class JSDoc.
- everything else: header listing the module's public exports.
Also normalizes '@author Carlos G' to '@author **Carlos G**' (original convention).

Idempotent: files that already have '@author' are only normalized, never re-headered.
"""
import os
import re

ROOT = "src"
AUTHOR = "**Carlos G**"


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, t):
    with open(p, "w", encoding="utf-8") as f:
        f.write(t)


def field(text, name):
    m = re.search(r"^\s*" + name + r"\s*=\s*(['\"`])(.*?)\1\s*;?\s*$", text, re.M)
    return m.group(2).strip() if m else None


def sanitize(s):
    return s.replace("*/", "*\\/").replace("\n", " ").strip()


def layer_of(path):
    parts = path.split(os.sep)
    return parts[1] if len(parts) >= 2 else "src"


def insert_header(text, header):
    lines = text.split("\n")
    i = 0
    if lines and lines[0].startswith("#!"):
        i = 1
    while i < len(lines) and lines[i].strip() == "":
        i += 1
    return "\n".join(lines[:i] + header.split("\n") + [""] + lines[i:])


def has_comment_above(lines, idx):
    j = idx - 1
    seen = 0
    while j >= 0 and seen < 3:
        s = lines[j].strip()
        if s == "":
            j -= 1
            continue
        seen += 1
        return s.endswith("*/") or s.startswith(("//", "*", "/*"))
    return False


def exports_of(text):
    out = []
    for kind in ("class", "interface", "function"):
        out += re.findall(
            r"^export\s+(?:default\s+)?(?:abstract\s+)?"
            + kind
            + r"\s+(\w+)",
            text,
            re.M,
        )
    out += re.findall(r"^export const (\w+)", text, re.M)
    seen = set()
    return [e for e in out if not (e in seen or seen.add(e))]


changed, normalized = [], []

for dp, ds, fs in os.walk(ROOT):
    ds.sort()
    for f in sorted(fs):
        if not f.endswith(".ts"):
            continue
        p = os.path.join(dp, f)
        t = read(p)

        if "@author" in t:
            t2 = t.replace("@author Carlos G\n", "@author " + AUTHOR + "\n")
            if t2 != t:
                write(p, t2)
                normalized.append(p)
            continue

        base = f[:-3]
        cmd_class = None
        for m in re.finditer(
            r"^export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)"
            r"(?:\s+extends\s+(\w+))?",
            t,
            re.M,
        ):
            if m.group(2) == "Command":
                cmd_class = m.group(1)
                break

        if cmd_class:
            name = sanitize(field(t, "name") or base)
            desc = sanitize(field(t, "description") or "")
            usage = sanitize(field(t, "usage") or "")
            cat = re.search(r"^\s*category\s*=\s*CommandCategory\.(\w+)", t, re.M)
            catl = cat.group(1).lower() if cat else "command"
            hdr = ["/**", " * " + f, " *",
                   " * " + catl + " command `" + name + "`"
                   + ((" — " + desc) if desc else "")]
            if usage:
                hdr.append(" * Usage: " + usage)
            hdr += [" *", " * @author " + AUTHOR, " */"]
            header = "\n".join(hdr)
        else:
            lyr = layer_of(p)
            if base == "index":
                line = "Barrel module re-exporting the " + lyr + " layer's public API."
            else:
                exps = exports_of(t)[:4]
                if exps:
                    what = ", ".join("`" + e + "`" for e in exps)
                    line = "VaniaBot " + lyr + " module exposing " + what + "."
                elif re.search(r"^export\s*\{", t, re.M):
                    line = "Barrel module re-exporting the " + lyr + " layer's public API."
                else:
                    line = "VaniaBot " + lyr + " module (internal helpers)."
            hdr = ["/**", " * " + f, " *", " * " + line, " *",
                   " * @author " + AUTHOR, " */"]
            header = "\n".join(hdr)

        t = insert_header(t, header)

        if cmd_class:
            lines = t.split("\n")
            for idx, ln in enumerate(lines):
                if re.match(
                    r"^export\s+(?:default\s+)?(?:abstract\s+)?class\s+"
                    + cmd_class
                    + r"\b",
                    ln,
                ):
                    if not has_comment_above(lines, idx):
                        indent = ln[: len(ln) - len(ln.lstrip())]
                        cdesc = sanitize(field(t, "description") or "command handler")
                        doc = (
                            "/** Command handler for `!"
                            + (field(t, "name") or base)
                            + "`: "
                            + cdesc.rstrip(".")
                            + ". */"
                        )
                        lines.insert(idx, indent + doc)
                        t = "\n".join(lines)
                    break

        write(p, t)
        changed.append(p)

print("headers inserted:", len(changed))
for p in changed:
    print("  +", p)
print("author normalized:", len(normalized))
for p in normalized:
    print("  ~", p)
