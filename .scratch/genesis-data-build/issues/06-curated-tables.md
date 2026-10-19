# 06: Curated tables

**What to build:** the owner's reviewed corrections reach the export, and stale or unreviewed rows never do. Three tables apply over Theographic: partners (spouse, concubine, both, partner, or none for each pair), possibly same (POSSIBLY_SAME_AS links), and corrections (attribute fixes, with `was` holding the upstream value the fix replaced). Each shipped curated item carries its Evidence Verses, note, and request link into the entity file, so the detail panel can show "Corrected after review".

Rules: a row ships only when `reviewed` is yes. Every row needs at least one Evidence Verse that parses to a valid Verse Key, or the build fails. Redundant rows (upstream now has the curated value) still apply and are reported. Rows that no longer match (an ID is missing, or for corrections, upstream holds neither `was` nor `value`) are not applied and are reported. Rows that fix plain Theographic errors are listed for upstream reporting.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Abraham and Sarah ship as SPOUSE_OF; Abraham and Hagar ship as both SPOUSE_OF and CONCUBINE_OF, each with its Evidence Verses
- [ ] Anah and Beeri have no partner edge, and they have a POSSIBLY_SAME_AS link with its Evidence Verses and note
- [ ] Anah's gender ships as M, with the evidence and a "corrected" marker
- [ ] A partner pair with no row still ships as PARTNER_OF and is in the uncurated report
- [ ] An unreviewed row does not ship and is in the unreviewed report
- [ ] A row with no Evidence Verse, or one that does not parse, makes the build fail with a clear message
- [ ] A redundant correction applies and is in the redundant report
- [ ] A correction that no longer matches is not applied and is in the no-longer-matches report
- [ ] The fixtures cover each partner relation value
