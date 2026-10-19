# Licences

Status: reviewed by the owner on 2026-10-19.
Checked: 2026-10-19.
This is not legal advice.

This file records each source, its licence, where the licence is stated, and the date we checked it. It meets PRD section 5, rule 7, and the M0 task in `docs/specs/genesis-data-build.md`.

Quotes are copied from the upstream text on the date checked. Where we could not confirm something, the line starts with "UNVERIFIED:".

## Summary

| Source | What we use | Licence as stated | Ships in the dataset | Checked |
|---|---|---|---|---|
| Berean Standard Bible (BSB) | Verse text | Dedicated to the public domain, linked to CC0 1.0 | Yes | 2026-10-19 |
| Theographic Bible Metadata | People, places, events, people groups, verse links, family links, Easton's text, links from places to OpenBible.info records | CC BY-SA 4.0 | Yes | 2026-10-19 |
| Easton's Bible Dictionary (through Theographic) | Dictionary Entry text | Not stated by Theographic. CCEL marks it "Public Domain". See notes. | Yes | 2026-10-19 |
| OpenBible.info cross-references | Verse to verse edges and votes | CC BY 4.0 (page links to the 4.0 licence) | Yes | 2026-10-19 |
| OpenBible.info geocoding | Place coordinates and confidence | CC BY 4.0; OpenStreetMap data is ODbL 1.0 | Yes, CC BY points only | 2026-10-19 |
| Pleiades | Replacement coordinates | CC BY 3.0 | Yes | 2026-10-19 |
| Wikidata | Replacement coordinates | CC0 (structured data) | Yes | 2026-10-19 |
| GeoNames | Replacement coordinates | CC BY 4.0 | Yes | 2026-10-19 |
| STEPBible TIPNR | Build-time check only | CC BY 4.0, with a request not to repost the file | No | 2026-10-19 |
| Nave's Topical Bible (bible-data) | Themes and Filed Under links | CC BY 4.0 (the dataset) | Yes | 2026-10-19 |

## 1. Licences of this project

### Code: MIT

The code is under the MIT licence. See `LICENSE` in the repository root. Decision 18 records this.

### Data: CC BY-SA 4.0

The combined dataset is under CC BY-SA 4.0. See `LICENSE-DATA` in the repository root.

Reason: Theographic is CC BY-SA 4.0. Our graph is built from Theographic, so it is "Adapted Material" under that licence. The ShareAlike clause then fixes the licence we can use. Section 3(b)(1) of the Theographic LICENSE says:

> The Adapter's License You apply must be a Creative Commons license with the same License Elements, this version or later, or a BY-SA Compatible License.

The other shipped sources fit inside CC BY-SA 4.0:

- CC0 and public domain sources (BSB, Wikidata) have no conditions.
- CC BY sources (OpenBible.info, Pleiades, GeoNames, Nave's dataset) need attribution only. They allow adapted material under another licence, so CC BY-SA 4.0 is allowed.

Why the code and the data have different licences: the code does not contain the dataset. A share-alike data licence on code would confuse users and is not needed. The one exception is test fixtures (section 5).

### Conditions we must meet as a CC BY-SA 4.0 publisher

1. Credit each source. The credits page (`credits.json`) lists every source, its licence, and its link (PRD section 5, rule 6).
2. Say that we changed the data. CC BY-SA 4.0, section 3(a)(1)(B), asks us to "indicate if You modified the Licensed Material and retain an indication of any previous modifications". Our curated tables change Theographic data (for example Anah's gender). The credits page should say that the data is modified, and link to the curated tables.
3. Link to the licence text of each source.
4. Every node and edge carries `source` and `licence` (PRD section 5, rule 3).

## 2. Rule: no CC BY-NC sources

The build must not use any source under a NonCommercial (NC) licence. This is PRD section 5, rule 4.

Reason: CC BY-NC material cannot be placed under CC BY-SA 4.0. CC BY-SA 4.0 allows commercial reuse. An NC licence forbids it. So an NC source would break the licence of the whole dataset.

Known NC sources to avoid: ETCBC BHSA, STEPBible TTESV.

How the build enforces it: each source in `pipeline/download.py` has a licence string. The build stops if any licence string contains "NC". (Spec, user story 4.)

Note: a licence that is not NC can still carry an NC-like limit in its terms. See the CCEL note under Easton's (section 3.3).

## 3. Sources

### 3.1 Berean Standard Bible (BSB)

- URL: https://bereanbible.com/bsb.txt (download). Licence pages: https://berean.bible/licensing.htm and https://berean.bible/terms.htm
- Use: main verse text.
- Licence as stated: dedicated to the public domain. The words "dedicated to the public domain" link to https://creativecommons.org/publicdomain/zero/1.0/ (CC0 1.0).
- Where stated:
  - berean.bible/terms.htm (dated April 30, 2023): "The Berean Bible and Majority Bible texts are officially dedicated to the public domain as of April 30, 2023." and "All uses are freely permitted."
  - berean.bible/licensing.htm: "The Berean Bible and Majority Bible texts are officially placed into the public domain as of April 30, 2023." and "Licensing is not required for any use."
  - The first lines of bsb.txt: "This text of God's Word has been dedicated to the public domain. Free resources and databases are available at BereanBible.com."
- No repository, so no LICENSE file.
- Date checked: 2026-10-19.
- Conditions:
  - Attribution is "appreciated but not required". Suggested wording, from the terms page: "The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. This text of God's Word has been dedicated to the public domain." (The header of bsb.txt also names unfoldingWord and Bible Aquifer.)
  - A request about the name: "For derivative works that vary from the official text, we respectfully request that the Berean name is not used." So we keep the verse text verbatim if we call it the BSB.
- Notes: berean.bible blocks some automated requests (HTTP 406). A browser user agent works.

### 3.2 Theographic Bible Metadata

- URL: https://github.com/robertrouse/theographic-bible-metadata (branch `master`, commit `52e049e`, 2026-10-14).
- Use: people, places, events, people groups, verse links, family links, and Easton's text (`dictText`). Theographic decides entity identity.
- Also `geo/bible-places.geojson` (Linked Places Format, same repository and licence, checked 2026-10-19). The build reads only each feature's `links`, to join a Theographic place to its OpenBible.info record (decision 56). The feature's `geometry` is a Theographic coordinate and never ships (decision 41); the fixture copy has `geometry` set to null.
- Licence as stated: CC BY-SA 4.0.
- Where stated:
  - `LICENSE` file: the full text of "Attribution-ShareAlike 4.0 International".
  - `readme.md`, section "License": "This work is free to use and copy under a Creative Commons Attribution-ShareAlike 4.0 International License. Please also credit the original sources, several of which have their own licenses."
  - GitHub reports the repository licence as `CC-BY-SA-4.0`.
- Date checked: 2026-10-19.
- Conditions:
  - Attribution. Share-alike (section 1 above). Indicate changes.
  - The readme asks us to "also credit the original sources". These are listed in `docs/data-source-bibliography.md` in that repository. The credits page should link to that list.
- What it says about Easton's text: the readme does not give Easton's text its own licence. `docs/data-source-bibliography.md` says: "Easton, M. G. *Easton's Bible Dictionary* (1897). Text parsed from the Christian Classics Ethereal Library XML edition: ccel.org/ccel/easton/ebd2.xml." So Theographic ships Easton's text inside its CC BY-SA 4.0 work. See 3.3.
- Notes:
  - Theographic `places.json` has its own coordinates: `latitude`, `longitude`, `openBibleLat`, `openBibleLong`, and `recogitoLat`, `recogitoLon`. Its docs say `latitude` and `longitude` are "chosen after comparing OpenBible.info and Recogito matches". These can include OpenBible points that came from OpenStreetMap. The build must not ship any Theographic coordinate field. Coordinates come only from the filtered OpenBible data and the replacement sources.
  - Theographic `verses.json` holds King James Version text. We do not ship it. UNVERIFIED: in the United Kingdom the KJV text is under Crown rights managed by Cambridge University Press. We could not load the Cambridge rights page on 2026-10-19 (HTTP 403 and 503). Keep KJV text out of the export and out of fixtures until this is checked.
  - Theographic draws on sources with licences we did not check (for example Marshall Genealogy, Complete Bible Genealogy, Digital Manna). We rely on Theographic's own CC BY-SA 4.0 grant.

### 3.3 Easton's Bible Dictionary (through Theographic)

- URL: we take it from Theographic `easton.json` and `dictText`. Theographic's source: https://www.ccel.org/ccel/easton/ebd2.xml
- Use: Dictionary Entry text for entities, always labelled "Easton's Bible Dictionary (1897)".
- Licence as stated:
  - Theographic: no separate statement. The text comes inside a CC BY-SA 4.0 work.
  - CCEL XML header: `<DC.Rights>Public Domain</DC.Rights>`. The same file also has the comment `<!-- Copyright Christian Classics Ethereal Library -->`.
  - CCEL work page: "Born: AD 1823 Died: AD 1894". The XML says the book "was published in 1897, three years after the author's death."
  - CCEL copyright policy (https://www.ccel.org/about/copyright.html): "Most of the editions at the Christian Classics Ethereal library are based on books that are public domain in the United States." and "These books may be used for personal, educational, or non-profit purposes. Contact us for permission to republish CCEL works or to use them commercially."
- Date checked: 2026-10-19.
- Conditions: credit "Easton's Bible Dictionary (1897)" and Theographic.
- Decision (decision 38): the text ships as public domain. The licence field reads "Public domain (1897)", and the source names Theographic and CCEL.
- Reason: the author died in 1894, so the text is public domain. CCEL's permission request is a policy on its site, not a licence term on the text. We take plain text from Theographic, not CCEL's edition or markup. The owner accepts the remaining risk.

### 3.4 OpenBible.info cross-references

- URL: https://www.openbible.info/labs/cross-references/ ; download https://a.openbible.info/data/cross-references.zip
- Use: verse to verse edges with vote scores.
- Licence as stated: Creative Commons Attribution. The link goes to https://creativecommons.org/licenses/by/4.0/ (CC BY 4.0).
- Where stated:
  - Page footer: "Unless otherwise indicated, all content is licensed under a Creative Commons Attribution License."
  - First line of `cross_references.txt` in the zip: `#www.openbible.info CC-BY 2026-10-12`.
- No repository, so no LICENSE file.
- Date checked: 2026-10-19. The zip holds one file, `cross_references.txt`, with 344,799 data rows.
- Conditions: attribution to OpenBible.info with a link. Indicate changes (we trim low vote rows).
- Notes: the page says most data comes from the Treasury of Scripture Knowledge. The same footer says Scripture quotations on the site are from the ESV. The zip holds only verse references and votes, no ESV text.

### 3.5 OpenBible.info geocoding

- URL: https://github.com/openbibleinfo/Bible-Geocoding-Data (branch `main`, commit `7eb18a5`, 2021-11-01).
- Use: place coordinates and confidence. Only CC BY points ship (PRD section 5, rule 8).
- Licence as stated: CC BY 4.0 for the data; ODbL 1.0 for OpenStreetMap data.
- Where stated:
  - `license.txt`: the full text of "Attribution 4.0 International". It does not mention ODbL.
  - `readme.md`, section "License":
    > This data is licensed under a Creative Commons Attribution 4.0 license.
    >
    > OpenStreetMap data is licensed under ODbL 1.0, which is similar to CC-BY-SA.
    >
    > The licenses for images vary depending on the image but are open and are generally Creative Commons or similar.
  - GitHub reports the repository licence as `CC-BY-4.0`.
- What the readme says about commercial sources: only one line, in the field list for `modern.jsonl`: "`custom_lonlat`: when the coordinates are derived from a commercial source, this value provides a nearby but independently created longitude, latitude pair". It gives no licence for commercial coordinates.
- What the readme says about OpenStreetMap fields: "`precise`: geometry from OpenStreetMap"; "`local`: when a settlement or other point feature ... has OpenStreetMap geometry"; "`precise_geometry_id`: a geometry id with data from OpenStreetMap". In `secondary_sources`, types "osm" and "osm_group" link to OpenStreetMap.
- Date checked: 2026-10-19.
- Counts in `modern.jsonl` on 2026-10-19 (1,595 locations):
  - `coordinates_source.type` is "osm": 51.
  - `custom_lonlat` present: 11 (9 "amudanan", 1 "daahl", 1 "osm"). So one location is in both groups. Together they are 61 locations, not 62.
  - Other types that may need a look: "google_maps" 5, "google_earth_community" 1.
- Conditions: attribution to OpenBible.info with a link. Indicate changes.
- See section 4 for our reading of the split.

### 3.6 Pleiades

- URL: https://pleiades.stoa.org/ ; data https://pleiades.stoa.org/downloads and https://github.com/isawnyu/pleiades.datasets
- Use: replacement coordinates for places whose OpenBible point is dropped (first choice).
- Licence as stated: CC BY 3.0 (Creative Commons Attribution 3.0 Unported).
- Where stated:
  - Downloads page and credits page footer: "Sharing and remixing permitted under terms of the Creative Commons Attribution 3.0 License (cc-by)."
  - Home page: "All content is distributed under the terms of a Creative Commons Attribution license (cc-by)."
  - `pleiades.datasets` `LICENSE` file: "Creative Commons Legal Code / Attribution 3.0 Unported". Its README: "All content is distributed under the terms of a Creative Commons Attribution license (cc-by)."
- Date checked: 2026-10-19.
- Conditions: attribution to Pleiades and its contributors, with a link. The datasets README says: "we encourage use and citation of numbered releases". Record the release number we use.
- Notes: the PRD says "CC BY" with no version. The version is 3.0.
- Download: the daily locations dump, https://atlantides.org/downloads/pleiades/dumps/pleiades-locations-latest.csv.gz. It has no release number, so the manifest's date and SHA-256 identify the version we use. Some Pleiades locations are based on OpenStreetMap, and a place's own point blends them in; the build uses only the other locations (decision 84).

### 3.7 Wikidata

- URL: https://www.wikidata.org/wiki/Wikidata:Copyright and https://www.wikidata.org/wiki/Wikidata:Licensing
- Use: replacement coordinates (second choice). Phase 2: outward links (QIDs).
- Licence as stated: CC0 for structured data.
- Where stated (page footer of Wikidata:Copyright): "All structured data from the main, Property, Lexeme, and EntitySchema namespaces is available under the Creative Commons CC0 License; text in the other namespaces is available under the Creative Commons Attribution-ShareAlike License; additional terms may apply."
- Wikidata:Licensing: "All data in Wikidata has a CC0 license."
- Date checked: 2026-10-19.
- Conditions: none. We still record Wikidata as the source of each coordinate.
- Notes: coordinates (property P625) are structured data, so they are CC0. Wikidata's licence statement does not tell us where each value came from, so the build checks the references on each coordinate (decisions 43 and 58). Limitation: a coordinate "imported from" a Wikipedia may itself have come from OpenStreetMap; its reference cannot show that.
- Download: one SPARQL query to https://query.wikidata.org/sparql, saved as `wikidata-coords.json`, with the query saved as `wikidata-query.sparql` and its SHA-256 in the manifest (decisions 83 and 108).

### 3.8 GeoNames

- URL: https://www.geonames.org/ ; dumps https://download.geonames.org/export/dump/
- Use: replacement coordinates (third choice).
- Licence as stated: CC BY 4.0.
- Where stated:
  - About page footer: "This work is licensed under a Creative Commons Attribution 4.0 License."
  - Dump `readme.txt`: "This work is licensed under a Creative Commons Attribution 4.0 License, see https://creativecommons.org/licenses/by/4.0/"
  - Export page, "Terms and Conditions": "You should give credit to GeoNames when using data or web services with a link or another reference to GeoNames." and "commercial usage is allowed".
- Date checked: 2026-10-19.
- Conditions: credit GeoNames with a link.
- Notes: the free web service has a limit: "10,000 credits daily limit per application (identified by the parameter 'username'), the hourly limit is 1000 credits." This does not apply: `download` uses the dump files, one per country for 22 Bible lands plus `no-country.zip` (decision 83).

### 3.9 STEPBible TIPNR

- URL: https://github.com/STEPBible/STEPBible-Data, folder "Proper Nouns" (branch `master`, last commit to the folder `ed476a8`, 2026-10-17). File: "TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt".
- Use: build-time check of identity and family links. Nothing ships (PRD section 5, rule 9).
- Licence as stated: CC BY 4.0.
- Where stated:
  - The repository has no LICENSE file (GitHub API: 404; repository licence: none).
  - `README.md`, title line: "STEPBible Data Repository **CC BY 4.0**".
  - Header of the TIPNR file: "Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)".
  - The file name itself ends "STEPBible.org CC BY".
- The "do not repost" request, quoted from the TIPNR file header:
  > Refer others to STEPBible.github.io/STEPBible-Data as the source of the data.
  > Please do not post copies of this data file elsewhere, so that this remains the single up-to-date source"
- The README is softer: "You are welcome to make a mirror, so long as it is kept up-to-date and has a link back here." We follow the stricter file header.
- Other conditions in the README: "**Credit it** to "STEP Bible" linked to www.STEPBible.org". The file header says: "You MAY make changes yourself, but you should include a note of changes that can be viewed by those who use your new data".
- Date checked: 2026-10-19.
- Notes:
  - The README says each individual "has a description in brief, short and article length (created by Claude 3 AI)". Decision 7 relies on this.
  - Theographic lists TIPNR as a source for people and verse tagging. So TIPNR's credit also reaches us through Theographic.

### 3.10 Nave's Topical Bible (bible-data)

- URL: https://github.com/BradyStephenson/bible-data, file `NavesTopicalDictionary.csv` (branch `main`, commit `720a8da`, 2026-10-03).
- Use: Themes and Filed Under links. Headings that are people or places are removed.
- Licence as stated: CC BY 4.0, for the whole repository.
- Where stated:
  - `LICENSE` file: the full text of "Creative Commons Attribution 4.0 International Public License". GitHub reports it as "Other" (NOASSERTION), but the text is CC BY 4.0.
  - `README.md`, section "License": "This project is licensed under a Creative Commons Attribution 4.0 International License." and "You are free to share, adapt, and use the data (including for commercial purposes) as long as appropriate credit is given."
  - `CITATION.cff`: `license: "CC-BY-4.0"`, DOI `10.5281/zenodo.19539956`, "If you use this dataset, please cite it as below."
- Date checked: 2026-10-19.
- Conditions: attribution to Brady Stephenson, "BibleData: Structured Datasets from the Holy Bible", with the DOI.
- Notes:
  - UNVERIFIED: that the Nave's text is public domain. The README and LICENSE do not say so. They do not say where the Nave's text was transcribed from. The PRD says "Public domain text". That is our inference from the age of the book, not an upstream statement.
  - The alternative, github.com/neuu-org/bible-topics-dataset, is CC BY 4.0 (GitHub metadata). Its README says "All sources are **public domain**" and that it uses CCEL ThML XML. We did not read its LICENSE file.

## 4. OpenBible.info geocoding: our licence split

This is not legal advice.

### What the readme states

The readme states two things:

1. The data is CC BY 4.0.
2. "OpenStreetMap data" is ODbL 1.0.

So the readme does state a split in general terms. It does not say which records or fields are "OpenStreetMap data". It says nothing about the licence of coordinates from commercial sources. `license.txt` holds CC BY 4.0 only.

### What we infer

The mapping from the licence statement to fields is our reading of the field documentation. It is not stated in the readme.

- ODbL (OpenStreetMap):
  - A location whose `coordinates_source.type` is "osm" (51 locations).
  - All `precise` and `local` geometry, and any `precise_geometry_id` or `local_geometry_id` file.
  - `secondary_sources` of type "osm" or "osm_group".
- Commercial source, licence unknown:
  - A location with a `custom_lonlat` value (11 locations). The readme says its main coordinates "are derived from a commercial source".
- CC BY 4.0: everything else, including points whose source is Wikidata, GeoNames, Pleiades, a book, or a georeferenced map.

### What the build does

- It drops every coordinate in the ODbL group and the commercial group (decision 39). It does not use `custom_lonlat`.
- It drops the 6 points whose source type is "google_maps" or "google_earth_community" (decision 40). Google's terms restrict copying map data, whatever the readme says.
- It drops points whose location has OpenStreetMap geometry (`geometry_credit` "osm"), whatever its `coordinates_source` (decision 57). The point may be computed from that geometry.
- A location with no `coordinates_source` takes its point from its `root` location, so the build checks the root by the same rules.
- It ships points only. No geometry files ship.
- It drops points whose source is a Wikidata item with a coordinate that cites OpenStreetMap (decision 58).
- It looks up dropped places in Pleiades, then Wikidata, then GeoNames (decisions 82 to 85). Each coordinate records `coord_source`. It skips Pleiades locations based on OpenStreetMap and Wikidata coordinates whose reference cites OpenStreetMap (decision 43).
- A test fails if any shipped coordinate has an OpenStreetMap source (spec, user story 49).

### Why

The dataset is CC BY-SA 4.0. ODbL 1.0 is also share-alike. Neither licence lists the other as compatible. So a dataset cannot meet both. See the decision record "OpenStreetMap coordinates" in `docs/decisions.md`.

### Correction to the decision record

The decision record says: "The split between the CC BY parts and the ODbL parts is our reading of the OpenBible readme. The readme does not state it." More precisely: the readme states that OpenStreetMap data is ODbL. It does not state which fields hold OpenStreetMap data. The field mapping is our reading.

The record also groups the 11 commercial points with the ODbL parts. The readme does not call them ODbL. Their licence is not stated.

## 5. Test fixtures

Test fixtures live in the code repository, which is MIT. Some fixtures hold real excerpts of source data.

Rules:

1. A fixture excerpt keeps the licence of its source. MIT does not apply to it.
2. A `README` in the fixture folder says so. It lists each fixture file, its source, its licence, and a link. It names the commit or download date of each source.
3. Expected licences in fixtures:
   - BSB slices: public domain (CC0 1.0).
   - Theographic slices: CC BY-SA 4.0.
   - OpenBible.info cross-references and geocoding slices: CC BY 4.0.
   - Nave's slices: CC BY 4.0.
   - Pleiades slices: CC BY 3.0. GeoNames slices: CC BY 4.0. Wikidata slices: CC0.
   - Curated tables: our own data, CC BY-SA 4.0 (they change Theographic data).
4. The TIPNR fixture is synthetic. We write it by hand in the TIPNR format. It holds no real TIPNR rows. Reason: TIPNR asks that the file is not posted elsewhere (section 3.9).
5. Do not put King James Version text from Theographic `verses.json` into fixtures. Strip `verseText` and similar fields. Reason: the UK status of the KJV is unverified (section 3.2).
6. Do not put real OpenStreetMap coordinates into fixtures. The spec needs "an OpenStreetMap point that is re-sourced and one that is not found". Use a real record with its coordinates replaced by made-up values, or a synthetic record. Keep `coordinates_source.type` as "osm". Reason: a real OpenStreetMap point in a public repository is ODbL data, even if it never ships.

## 6. Cloudflare free tier (not a licence)

Checked on 2026-10-19 against the official Cloudflare documentation. These values change. Check again before launch.

| Item | Free limit | Source (page "last updated" date) |
|---|---|---|
| KV reads | 100,000 per day | developers.cloudflare.com/kv/platform/limits (8 Oct 2026); developers.cloudflare.com/kv/platform/pricing (21 Apr 2026) |
| KV writes to different keys | 1,000 per day | same pages |
| KV writes to the same key | 1 per second | developers.cloudflare.com/kv/platform/limits |
| KV deletes and list requests | 1,000 per day each | developers.cloudflare.com/kv/platform/pricing |
| KV storage | 1 GB per account | developers.cloudflare.com/kv/platform/limits |
| KV reset | 00:00 UTC. "If you exceed any one of these limits, further operations of that type will fail with an error." | developers.cloudflare.com/kv/platform/pricing |
| R2 storage | 10 GB-month per month (Standard storage only) | developers.cloudflare.com/r2/pricing (1 Oct 2026) |
| R2 Class A operations | 1 million per month | same page |
| R2 Class B operations | 10 million per month | same page |
| R2 egress | Free | same page |
| Static asset requests | "free and unlimited" | developers.cloudflare.com/workers/static-assets/billing-and-limitations (23 Apr 2026) |
| Static asset files | 20,000 for each Worker version (Paid: 100,000) | developers.cloudflare.com/workers/platform/limits#static-assets (12 Oct 2026) |
| Static asset file size | 25 MiB for each file | same page |
| Workers Paid plan | "a minimum charge of $5 USD per month for an account" | developers.cloudflare.com/workers/platform/pricing |

Notes:

- The KV writes value in PRD section 8.4 (1,000 per day) is now confirmed. The secondary source said the quotas rose in February 2026. The official pages do not show a rise.
- The billing and limitations page no longer lists the static asset numbers. It links to the Workers limits page. PRD section 8.4 should cite the limits page.
- KV writes from the dashboard or Wrangler count against the quota: "any operations via the Cloudflare dashboard or wrangler ... count as billable KV usage."

## 7. Decisions and open points

Decided on 2026-10-19 (decisions 38 to 45 in `docs/decisions.md`):

1. Easton's ships as public domain (decision 38).
2. The 11 commercial OpenBible points are dropped and re-sourced. `custom_lonlat` is not used (decision 39).
3. The 6 Google sourced OpenBible points are dropped and re-sourced (decision 40).
4. No Theographic coordinate field ships (decision 41).
5. No KJV text goes into the export or the fixtures (decision 42). The UK position stays UNVERIFIED, so this rule stays.
6. A Wikidata coordinate whose reference says it came from OpenStreetMap is not used (decision 43).
7. Fixtures use made-up coordinates for OpenStreetMap records (decision 44).
8. The credits page says the data is modified, and links to Theographic's source bibliography (decision 45).
9. The PRD now says "dataset CC BY 4.0" for Nave's, with no public domain claim. Pleiades is CC BY 3.0. The cross-references are CC BY 4.0.
10. The credits page thanks STEPBible for TIPNR, marked as used for checks only (decision 46).

No points are open.
