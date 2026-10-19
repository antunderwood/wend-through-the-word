"""The credits file (PRD 5, rule 6): every source the build read, with its licence and link.
Wording and links come from docs/licences.md. Called by `export`, after every step has read
its sources."""

import sys

REPO = "https://github.com/antunderwood/wend-through-the-word"
THEOGRAPHIC = "https://github.com/robertrouse/theographic-bible-metadata"

# The part of a SOURCES name before the first "-" (so "theo-people" is "theo") -> credit.
CREDITS = {
    "bsb": {
        "name": "Berean Standard Bible (BSB)",
        "credit": "The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with "
        "Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. "
        "This text of God's Word has been dedicated to the public domain.",
        "link": "https://bereanbible.com/",
    },
    "theo": {
        "name": "Theographic Bible Metadata",
        "credit": "Theographic Bible Metadata, by Robert Rouse. Theographic draws on other "
        "sources; they are listed in its source bibliography.",
        "link": THEOGRAPHIC,
        "bibliography": f"{THEOGRAPHIC}/blob/master/docs/data-source-bibliography.md",  # dec. 45
    },
    "crossrefs": {
        "name": "OpenBible.info cross-references",
        "credit": "Cross-references from OpenBible.info.",
        "link": "https://www.openbible.info/labs/cross-references/",
    },
    "geo": {
        "name": "OpenBible.info Bible Geocoding Data",
        "credit": "Place locations from OpenBible.info.",
        "link": "https://github.com/openbibleinfo/Bible-Geocoding-Data",
    },
    # Lookups for Places whose OpenBible point is dropped (licences.md 3.6 to 3.8).
    "pleiades": {
        "name": "Pleiades",
        "credit": "Place locations from Pleiades: A Gazetteer of Past Places, by its contributors.",
        "link": "https://pleiades.stoa.org/",
    },
    "wikidata": {
        "name": "Wikidata",
        "credit": "Place locations from Wikidata.",
        "link": "https://www.wikidata.org/",
    },
    "geonames": {
        "name": "GeoNames",
        "credit": "Place locations from GeoNames.",
        "link": "https://www.geonames.org/",
    },
    "tipnr": {
        "name": "STEP Bible: TIPNR",
        "credit": "Used to check the data; nothing from it is included.",  # decision 46
        "link": "https://www.stepbible.org/",
    },
    "naves": {
        "name": "Nave's Topical Bible (BibleData)",
        "credit": 'Brady Stephenson, "BibleData: Structured Datasets from the Holy Bible", '
        "doi:10.5281/zenodo.19539956.",
        "link": "https://github.com/BradyStephenson/bible-data",
    },
}
EASTONS = {  # comes inside Theographic's dictText; credited when a Dictionary Entry ships
    "name": "Easton's Bible Dictionary (1897)",
    "credit": "Easton's Bible Dictionary (1897), by M. G. Easton, through Theographic.",
    "link": "https://www.ccel.org/ccel/easton/ebd2.xml",
    "licence": "Public domain (1897)",  # decision 38
    "licence_link": None,
    "files": [],
}
LICENCE_LINKS = {
    "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
}


def credits(b):
    files = {}  # credit -> SOURCES names read
    for name in sorted(b.used):
        files.setdefault(name.split("-")[0], []).append(name)
    if missing := files.keys() - CREDITS.keys():
        sys.exit(f"no credit for sources {sorted(missing)}: add them to pipeline/credits.py")
    sources = []
    for group, credit in CREDITS.items():
        if group in files:
            licence = b.licence(files[group][0])
            sources.append(
                {
                    **credit,
                    "licence": licence,
                    "licence_link": LICENCE_LINKS[licence],
                    "files": files[group],
                }
            )
    if any("dictionary_entry" in e for e in b.entities.values()):
        sources.append(EASTONS)
    return {
        "licence": "CC BY-SA 4.0",
        "licence_link": LICENCE_LINKS["CC BY-SA 4.0"],
        # CC BY-SA 4.0 section 3(a)(1)(B) (decision 45)
        "modified": "This data is modified from the sources below. We selected and reshaped "
        "their records, and corrected some of them. The corrections are in the curated tables.",
        "curated_tables": f"{REPO}/tree/main/pipeline/curated",
        "sources": sources,
    }
