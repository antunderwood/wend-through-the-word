# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/decisions.md`**: the decision log. This repo keeps decisions as numbered, dated entries in this one file, not as ADR files under `docs/adr/`. Read the entries that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront.

## File structure

Single-context repo:

```
/
├── GLOSSARY.md
├── PRD.md
├── docs/decisions.md       ← numbered decisions, each with a date and a reason
├── docs/specs/
└── pipeline/
```

## Recording decisions

Record a new decision as the next numbered entry in `docs/decisions.md`, under a dated heading, with its reason (PRD section 16). Do not create ADR files.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision conflicts

If your output contradicts an existing decision, surface it explicitly rather than silently overriding:

> _Contradicts decision 27 (partners), but worth reopening because…_
