"""Write the synthetic ACAI fixture, sources/acai-v2026-10-30.zip. Run from the repo root:

    python -I tests/fixtures/make_acai.py

The records are written here by hand in ACAI's format (github.com/BibleAquifer/ACAI). Each one
says "Synthetic ACAI record, written for tests". Their references are the fixture Theographic
verses of the record they name, so each test case below is the only difference:

- Abraham has one more reference, Gen.11.1: a Mention only ACAI has.
- Isaac's father is Nahor, not Abraham: a family disagreement.
- Lydia's references are Acts 16 only: Theographic's links to Gen.36.22 are only Theographic's.
- Esau and Edom both name Esau's Theographic record: an identity disagreement.
- Terah and Nahor agree with Theographic. Nobody names Sarah: an Entity with no ACAI record.
"""

import json
import zipfile
from pathlib import Path

HERE = Path(__file__).parent / "sources"
people = {
    r["fields"].get("personLookup"): r for r in json.loads((HERE / "people.json").read_text())
}
keys = {r["id"]: r["fields"]["verseID"] for r in json.loads((HERE / "verses.json").read_text())}


def person(acai_id, slug, refs=None, **fields):
    rec = people[slug]
    return {
        "id": acai_id,
        "primary_id": acai_id,
        "type": "person",
        "note": "Synthetic ACAI record, written for tests",
        "alternate_sources": {"vizbible": [rec["id"]], "tipnr": [f"{acai_id[7:]}@synthetic"]},
        "references": refs
        if refs is not None
        else [keys[v] for v in rec["fields"]["verses"] if v in keys],
        **fields,
    }


abraham = person("person:Abraham", "abraham_58", father="person:Terah")
abraham["references"].append("01011001")
records = [
    abraham,
    person("person:Isaac", "isaac_616", father="person:Nahor"),
    person("person:Terah", "terah_2841"),
    person("person:Nahor", "nahor_2142"),
    person("person:Lydia", "lydia_1837", ["44016014", "44016040"]),
    person("person:Esau", "esau_1216"),
    person("person:Edom.person", "esau_1216", []),
]
with zipfile.ZipFile(HERE / "acai-v2026-10-30.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for r in records:
        info = zipfile.ZipInfo(
            f"ACAI-2026-10-30/people/json/{r['id'][7:]}.json", (2026, 10, 30, 0, 0, 0)
        )
        z.writestr(info, json.dumps(r, indent=1) + "\n", zipfile.ZIP_DEFLATED)
