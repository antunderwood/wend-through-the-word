# 10: Re-sourced coordinates

**What to build:** Places whose OpenBible point was dropped still get a point where an open source has one. `download` adds the Pleiades, Wikidata, and GeoNames data needed for the lookup, with checksums in the manifest like every other source. `build` looks each dropped Place up offline in Pleiades, then Wikidata, then GeoNames, and records which one gave the point.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] `download` fetches the Pleiades, Wikidata, and GeoNames data and records URL, date, and SHA-256 for each
- [ ] `build` still never touches the network
- [ ] A fixture OpenStreetMap Place that Pleiades knows gets a Pleiades coordinate
- [ ] A fixture OpenStreetMap Place that no source knows has no coordinate and is in the no-coordinate report
- [ ] The lookup order is Pleiades, then Wikidata, then GeoNames
- [ ] The credits list each lookup source with its licence
