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
    // Fixture: three People named Anah, and two Places named Sitnah that share Gen 26:21, so the
    // first Sitnah falls back to the number in its ID (decision 122).
    expect(["person:anah_247", "person:anah_248", "person:anah_249"].map(data.label)).toEqual([
      "Anah (Gen 36:2)",
      "Anah (Gen 36:20)",
      "Anah (Gen 36:24)",
    ]);
    expect(data.label("place:sitnah_1102")).toBe("Sitnah (1102)");
    // Canaan is a Person and a Place: the type icon and colour tell them apart, not a hint.
    expect(data.label("person:canaan_914")).toBe("Canaan");
    expect(data.label("place:canaan_272")).toBe("Canaan");
  });

  it("gives a Verse a short BSB quote once its record is loaded", async () => {
    const data = await createData(readExport, "");
    expect(data.quote("01025005")).toBe("");
    await data.load("01025005");
    await data.load("01025008");
    expect(data.label("01025005")).toBe("Gen 25:5");
    expect(data.quote("01025005")).toBe("Abraham left everything he owned to Isaac.");
    // Gen 25:8 is one sentence of 103 characters, so it is cut.
    expect(data.quote("01025008")).toBe("And at a ripe old age he breathed his last and died, old and contented, and was gathered...");
  });
});
