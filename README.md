# Wend Through the Word

An explorable graph of the Bible. A reader moves from a verse or an entity to the items linked to it.

The plan is in `PRD.md`. Terms are in `GLOSSARY.md`. Decisions are in `docs/decisions.md`.

## Licences

- Code: MIT (`LICENSE`).
- Data: CC BY-SA 4.0 (`LICENSE-DATA`), because Theographic Bible Metadata is CC BY-SA.
- Each source and its licence: `docs/licences.md`.

## Build

```
uv sync
uv run python -m pipeline.download
uv run python -m pipeline.build build.toml
```

`build` reads only local files. It writes the static export to `out/data/` and the reports to `out/reports/`. `build.toml` sets the book range, the build date, and the data version. `out/reports/summary.html` sums up the reports (counts, counts per book, first rows); to see what changed, set `previous_reports` in the config to a previous build's reports folder (it may be `out/reports` itself, which is read before it is replaced).

`uv run pytest` runs the tests on the fixtures in `tests/fixtures/`. The full Genesis test also runs when `sources/` holds a download (or set `WEND_SOURCES`).

The download writes to `sources/` and records each file's URL, date, and SHA-256 in `sources/manifest.json`.
If a host is blocked, fetch the file by hand and run `uv run python -m pipeline.download --supply NAME FILE`.

## Front end

The page is in `web/` (TypeScript, Svelte 5, Vite, three.js, and Leaflet for the map). `npm run dev` there serves it with the export in `out/data/`, or the one in `WEND_DATA`.

Its tests read an export built from the fixtures:

```
uv run python -c "import sys; sys.path.insert(0, 'tests'); from pathlib import Path; from conftest import run_build; run_build(Path(sys.argv[1]))" "$PWD/.fixture-export"
cd web && npm ci
export WEND_DATA=../.fixture-export/data
npm test                # Vitest
npx playwright test     # the built page in Chromium
npm run check           # svelte-check
```

## Release

`uv run python -m pipeline.release <tag>` releases the local export, and the Deploy workflow puts it live. See `docs/runbook.md` for releasing, rolling back, and the weekly usage check.

## Corrections

Use the "Correction request" issue form. Every request needs at least one verse as evidence.
