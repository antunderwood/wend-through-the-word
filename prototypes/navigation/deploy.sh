#!/usr/bin/env bash
# PROTOTYPE, throwaway. Stage the navigation prototype and the Genesis export, then deploy them to Cloudflare
# as a Worker with static assets (wrangler 4 hands Pages commands over to Workers). First time only: `npx wrangler@4 login`.
# Usage: prototypes/navigation/deploy.sh [--stage-only] [worker-name] [extra wrangler deploy flags, e.g. --dry-run]
# The site root sends each tester to a random first variant; the panel links to a credits page built from credits.json.
set -euo pipefail
stage_only=0
if [[ "${1:-}" == "--stage-only" ]]; then stage_only=1; shift; fi
project="${1:-wend-nav-prototype}"
shift || true
root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
site="$(mktemp -d)/site"
mkdir -p "$site/prototypes/navigation" "$site/out"
cp "$root/prototypes/navigation/model.js" "$site/prototypes/navigation/"
cp -R "$root/out/data" "$site/out/data"
# The curated tables are the record of our changes (CC BY-SA 4.0 section 3(a)(1)(B), decision 45).
mkdir -p "$site/curated" && cp "$root"/pipeline/curated/*.csv "$site/curated/"

python3 - "$root" "$site" <<'EOF'
import html, json, pathlib, sys
root, site = map(pathlib.Path, sys.argv[1:])
# The page, with a credits line in the panel (CC BY and CC BY-SA need visible attribution).
page = (root / "prototypes/navigation/index.html").read_text()
mark = '<div id="pHint"'
assert page.count(mark) == 1
page = page.replace(mark, '<div class="muted small" style="margin-top:4px">Data CC BY-SA 4.0, modified from several sources. '
                          '<a class="lk" href="../../credits.html" target="_blank" rel="noopener">Credits</a></div>\n  ' + mark)
(site / "prototypes/navigation/index.html").write_text(page)
# Credits page from the export's credits.json.
data = site / "out/data"
version = json.loads((data / "index.json").read_text())["data_version"]
c = json.loads((data / version / "credits.json").read_text())
e = lambda s: html.escape(s or "")
a = lambda href, text: f'<a href="{e(href)}">{e(text)}</a>' if href else e(text)
rows = "".join(
    f'<li>{a(s.get("link"), s.get("name"))}, licence {a(s.get("licence_link"), s.get("licence"))}. {e(s.get("credit"))}'
    + (f' {a(s["bibliography"], "Source bibliography")}.' if s.get("bibliography") else "") + "</li>"
    for s in c["sources"])
tables = "".join(f'<li><a href="curated/{e(f.name)}">{e(f.name)}</a></li>' for f in sorted((site / "curated").glob("*.csv")))
(site / "credits.html").write_text(f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Data credits</title>
<style>body{{font:15px/1.5 system-ui,sans-serif;max-width:46rem;margin:2rem auto;padding:0 16px;background:#0d0f17;color:#e6e8f0}}a{{color:#ffd27a}}li{{margin:.5rem 0}}</style></head>
<body><h1>Data credits</h1><p>The data is licensed <a href="{e(c["licence_link"])}">{e(c["licence"])}</a>. {e(c["modified"])}</p>
<ul>{rows}</ul>
<h2>Our changes</h2><p>The corrections, added links, and kept headings, each with its evidence verse, are in the curated tables:</p>
<ul>{tables}</ul></body></html>""")
# Start page: a random first variant; testers then go round in order (A to B to C to A) with the arrow in the pill.
(site / "index.html").write_text("""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Navigation prototype</title>
<script>location.replace("prototypes/navigation/?variant=" + "ABC"[Math.floor(Math.random() * 3)]);</script></head>
<body><a href="prototypes/navigation/?variant=A">Open the prototype</a></body></html>""")
EOF

echo "Staged: $site ($(find "$site" -type f | wc -l | tr -d ' ') files)"
if [[ $stage_only == 1 ]]; then exit 0; fi
cd "$(dirname "$site")"   # no wrangler config here, so only the flags below apply
npx --yes wrangler@4 deploy --assets "$site" --name "$project" --compatibility-date 2026-10-19 "$@"
