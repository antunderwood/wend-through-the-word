# 11: Nave's Themes

**What to build:** readers can explore topics such as Faith. Nave's headings load as Themes, stored as Entities under the same layout as other Entities. Verses link to their Themes by FILED_UNDER (not MENTIONS: a Verse does not name a Theme, Nave placed it there). Headings that are Theographic People or Places are removed and reported, so no Entity is duplicated. Themes feed into CO_MENTION through their Filed Under Verses.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Each kept heading has an entity file under the Theme type
- [ ] Verses link to Themes by FILED_UNDER
- [ ] A fixture heading that matches a Person is not a Theme and is in the removed headings report
- [ ] A Theme and a Person that share Verses have a CO_MENTION edge
- [ ] Themes appear in the search index
- [ ] Every Theme and FILED_UNDER link carries a `source` and a `licence`
