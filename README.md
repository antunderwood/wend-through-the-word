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
```

The download writes to `sources/` and records each file's URL, date, and SHA-256 in `sources/manifest.json`.
If a host is blocked, fetch the file by hand and run `uv run python -m pipeline.download --supply NAME FILE`.

## Corrections

Use the "Correction request" issue form. Every request needs at least one verse as evidence.
