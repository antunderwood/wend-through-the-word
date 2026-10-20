import { describe, expect, it } from "vitest";
import { createData } from "../src/data";
import { readExport } from "./fixture";

const ABRAHAM = "person:abraham_58";

describe("data loader", () => {
  it("reads index.json, then only files under its data_version", async () => {
    const read: string[] = [];
    const data = await createData(async (url) => (read.push(url), readExport(url)), "");
    await data.load(ABRAHAM);
    expect(read).toEqual(["/index.json", "/test1/search-index.json", "/test1/entity/person/abraham_58.json"]);
  });

  it("retries a fetch that fails once", async () => {
    let failures = 1;
    const data = await createData(async (url) => {
      if (url.includes("abraham") && failures-- > 0) throw new Error("network blip");
      return readExport(url);
    }, "");
    expect((await data.load(ABRAHAM)).id).toBe(ABRAHAM);
  });

  it("reports a fetch that fails twice, and does not keep the failure", async () => {
    let failures = 2;
    const data = await createData(async (url) => {
      if (url.includes("abraham") && failures-- > 0) throw new Error("network blip");
      return readExport(url);
    }, "");
    await expect(data.load(ABRAHAM)).rejects.toThrow("network blip");
    // The next try fetches again rather than giving back the old failure.
    expect((await data.load(ABRAHAM)).id).toBe(ABRAHAM);
  });

  it("gives an Entity record its Neighbours and Verses as links, by weight then ID", async () => {
    const data = await createData(readExport, "");
    const abraham = await data.load(ABRAHAM);
    // Fixture: Isaac is Abraham's heaviest Neighbour (cosine 0.5111, tests/test_comention.py), and
    // Gen 11:31 his heaviest Verse (11 other Entities in it).
    expect(abraham.links.find((l) => l.type === "person")).toMatchObject({ id: "person:isaac_616", weight: 0.5111 });
    expect(abraham.links.find((l) => l.type === "verse")).toMatchObject({ id: "01011031", weight: 11 });
    expect(data.label(ABRAHAM)).toBe("Abraham");
  });

  it("gives the Verses two nodes share, in order, with their BSB text", async () => {
    const data = await createData(readExport, "");
    // Genealogy stands in for Faith, which shares no Verse with Abraham in the fixture.
    const shared = await data.shared(ABRAHAM, "theme:genealogy");
    expect(shared.map((v) => data.label(v.key))).toEqual(["Gen 11:26", "Gen 11:27", "Gen 11:29", "Gen 11:31", "Gen 25:1", "Gen 25:12"]);
    expect(shared[0].text).toBe("When Terah was 70 years old, he became the father of Abram, Nahor, and Haran.");
    expect(shared[5].text).toBe(
      "This is the account of Abraham’s son Ishmael, whom Hagar the Egyptian, Sarah’s maidservant, bore to Abraham.",
    );
  });

  it("tells same-name Entities of one type apart by the hint after the name", async () => {
    const data = await createData(readExport, "");
    // Fixture: People named Anah, and two Places named Sitnah that share Gen 26:21, so the first
    // Sitnah falls back to the number in its ID (decision 122). A Person's relation that no other
    // Anah has comes before the hint (decision 125); anah_247 has none of its own, so shows its first (decision 126).
    expect(["person:anah_247", "person:anah_248", "person:anah_249"].map((id) => data.label(id))).toEqual([
      "Anah, son of Zibeon (Gen 36:2)",
      "Anah, son of Seir (Gen 36:20)",
      "Anah, brother of Ajah (Gen 36:24)",
    ]);
    // A panel list, whose Relationship words already say it, leaves the relation out.
    expect(data.label("person:anah_248", false)).toBe("Anah (Gen 36:20)");
    expect(data.label("place:sitnah_1102")).toBe("Sitnah (1102)");
    // Canaan is a Person and a Place: the type icon and colour tell them apart, not a hint.
    expect(data.label("person:canaan_914")).toBe("Canaan");
    expect(data.label("place:canaan_272")).toBe("Canaan");
  });

  it("says when a Verse is outside the build, without fetching it", async () => {
    const read: string[] = [];
    const data = await createData(async (url) => (read.push(url), readExport(url)), "");
    // Gen 16:1 has a Cross-reference to Gal 4:24; the fixture builds Gen 11, 16, 25, 26, 36, Matt 17, 3 John 1.
    expect((await data.load("01016001")).links.some((l) => l.id === "48004024")).toBe(true);
    expect(data.outside("48004024")).toBe("Gal 4:24 is outside this build (Genesis, Matthew, 3 John only).");
    expect(data.outside("01012001")).toBe("Gen 12:1 is outside this build (Genesis, Matthew, 3 John only).");
    expect(data.outside("01016001")).toBe("");
    expect(data.outside(ABRAHAM)).toBe("");
    await expect(data.load("48004024")).rejects.toThrow("Gal 4:24 is outside this build");
    expect(read.some((url) => url.includes("/Gal/"))).toBe(false);
  });

  it("gives a Verse its first BSB sentence once its record is loaded", async () => {
    const data = await createData(readExport, "");
    expect(data.quote("01025005")).toBe("");
    await data.load("01025005");
    await data.load("01025008");
    expect(data.label("01025005")).toBe("Gen 25:5");
    expect(data.quote("01025005")).toBe("Abraham left everything he owned to Isaac.");
    // Gen 25:8 is one sentence of 103 characters; the scene, not the loader, shortens it.
    expect(data.quote("01025008")).toHaveLength(103);
  });

  it("gives an Entity the first line of its Dictionary Entry once its record is loaded", async () => {
    const data = await createData(readExport, "");
    await data.load(ABRAHAM);
    // Fixture: Easton's entry for Abraham; its first sentence is 139 characters.
    expect(data.quote(ABRAHAM)).toMatch(/^Father of a multitude, son of Terah, .*promises\.$/);
  });
});

describe("details of an Entity", () => {
  const THEO = { source: "Theographic", licence: "CC BY-SA 4.0" };

  it("gives a Person's aliases and gender, and the Dictionary Entry, each with its source", async () => {
    const data = await createData(readExport, "");
    const abraham = await data.details(ABRAHAM);
    expect(abraham).toMatchObject(THEO);
    expect(abraham.facts).toEqual([
      { name: "Also called", value: "Abram", ...THEO },
      { name: "Gender", value: "Male", ...THEO },
    ]);
    expect(abraham.entry).toMatchObject({ source: "Easton's Bible Dictionary (1897)", licence: "Public domain (1897)" });
    expect(abraham.entry!.text).toMatch(/^Father of a multitude/);
    expect(abraham.corrections).toEqual([]);
  });

  it("gives a corrected item with its note, Evidence Verse, and request", async () => {
    const data = await createData(readExport, "");
    // Fixture: Anah's gender is corrected to Male (decision 28), with no request.
    expect((await data.details("person:anah_247")).corrections).toEqual([
      expect.objectContaining({ field: "gender", evidence: [{ verse_key: "01036024", label: "Gen.36.24" }], request: null, source: "Curated", licence: "CC BY-SA 4.0" }),
    ]);
  });

  it("gives an Event's year as approximate, in the Jones chronology, with BC and AD", async () => {
    const data = await createData(readExport, "");
    // Astronomical years (PRD 3): Theographic's -2245 is 2246 BC.
    expect((await data.details("event:53")).facts).toEqual([{ name: "Year", value: "2246 BC (approx., Jones chronology)", ...THEO }]);
    expect((await data.details("event:407")).facts).toEqual([{ name: "Year", value: "AD 29 (approx., Jones chronology)", ...THEO }]);
  });

  it("gives a Place's other names, and its coordinates with the source and licence of the point", async () => {
    const data = await createData(readExport, "");
    expect((await data.details("place:gerar_459")).facts).toEqual([
      { name: "Other names", value: "Valley of Gerar", ...THEO },
      { name: "Coordinates", value: "31.3821° N, 34.6065° E", source: "OpenBible.info Bible Geocoding Data", licence: "CC BY 4.0" },
    ]);
    const point = async (id: string) => (await data.details(id)).facts.find((f) => f.name === "Coordinates");
    expect(await point("place:bered_178")).toMatchObject({ source: "Pleiades", licence: "CC BY 3.0" });
    expect(await point("place:assyria_111")).toMatchObject({ source: "Wikidata", licence: "CC0 1.0" });
    expect(await point("place:machpelah_748")).toMatchObject({ source: "GeoNames", licence: "CC BY 4.0" });
    // Fixture: Babel's point is set by a curated correction (synthetic row, decision 89).
    expect(await point("place:babel_150")).toEqual({ name: "Coordinates", value: "32.5° N, 44.4° E", source: "Curated", licence: "CC BY-SA 4.0" });
    // Canaan has no point.
    expect(await point("place:canaan_272")).toBeUndefined();
  });
});
