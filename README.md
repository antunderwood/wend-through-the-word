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

`build` reads only local files. It writes the static export to `out/data/` and the reports to `out/reports/`. `build.toml` sets the book range, the build date, and the data version.

`uv run pytest` runs the tests on the fixtures in `tests/fixtures/`. The full Genesis test also runs when `sources/` holds a download (or set `WEND_SOURCES`).

The download writes to `sources/` and records each file's URL, date, and SHA-256 in `sources/manifest.json`.
If a host is blocked, fetch the file by hand and run `uv run python -m pipeline.download --supply NAME FILE`.

## Corrections

Use the "Correction request" issue form. Every request needs at least one verse as evidence.
