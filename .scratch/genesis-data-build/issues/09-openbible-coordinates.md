# 09: OpenBible coordinates

**What to build:** most Places have a point on the map, and no ODbL data ships. The build loads OpenBible.info coordinates with their confidence, and records `coord_source` on each one. Every point whose source is OpenStreetMap, a commercial source, or Google is dropped before anything else happens (decisions 10, 39, and 40). `custom_lonlat` is not used. Theographic's own coordinate fields never ship (decision 41).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Places with a CC BY OpenBible point have a coordinate, a confidence, and `coord_source` set to OpenBible
- [ ] A fixture OpenStreetMap point is not in the export
- [ ] A fixture commercial point is not in the export, and neither is its `custom_lonlat`
- [ ] A fixture Google sourced point is not in the export
- [ ] No Theographic coordinate value appears in the export
- [ ] Fixture OpenStreetMap records use made-up coordinates (decision 44)
- [ ] A test fails if any shipped coordinate has an OpenStreetMap source
- [ ] Places with no coordinate are listed in the no-coordinate report
