# 08: Cross-references and chapter Ring 2

**What to build:** a Verse Focus shows related Verses, filterable by Votes. OpenBible cross-references load as CROSS_REF edges with their Votes as weight. A cross-reference is kept when one end is outside the book range, so a Genesis Verse can still link to a Psalm. `3John.1.15` maps to `3John.1.14`. Each chapter gets a Ring 2 sidecar file holding IDs and weights only.

If a chapter file or sidecar would reach 500 KB, the build splits it or trims its lowest Vote cross-references, and reports the action.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Each chapter file shows the top cross-references of each Verse, with their Votes
- [ ] A Genesis Verse links to a Verse outside the book range
- [ ] A cross-reference to `3John.1.15` arrives at `3John.1.14`
- [ ] Each chapter has a Ring 2 sidecar file whose entries hold an ID and a weight only
- [ ] An oversized fixture file is split or trimmed, the lowest Votes go first, and the split or trimmed report lists it
- [ ] Cross-references with no Verse Key are in the verse mismatch report
- [ ] Every CROSS_REF edge carries a `source` and a `licence`
