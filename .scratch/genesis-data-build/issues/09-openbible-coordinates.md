# 09: OpenBible coordinates

**What to build:** most Places have a point on the map, and no ODbL data ships. The build loads OpenBible.info coordinates with their confidence, and records `coord_source` on each one. Every point whose source is OpenStreetMap, or the commercial source, is dropped before anything else happens (decision 10 and the OpenStreetMap record in the decision log).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Places with a CC BY OpenBible point have a coordinate, a confidence, and `coord_source` set to OpenBible
- [ ] A fixture OpenStreetMap point is not in the export
- [ ] A fixture commercial point is not in the export
- [ ] A test fails if any shipped coordinate has an OpenStreetMap source
- [ ] Places with no coordinate are listed in the no-coordinate report
