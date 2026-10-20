import { describe, expect, it } from "vitest";
import { createData } from "../src/data";
import { readExport } from "./fixture";

const ABRAHAM = "person:abraham_58";
const data = await createData(readExport, "");
const ids = (q: string, type?: Parameters<typeof data.search>[1]) => data.search(q, type).map((h) => h.id);

describe("search", () => {
  it("finds an Entity by name, the exact name first", () => {
    // Fixture: the Event "Abraham enters Canaan" and the Person "Haran (brother of Abraham)" also hold the name.
    expect(ids("abraham")[0]).toBe(ABRAHAM);
    expect(ids("abraham")).toEqual(expect.arrayContaining(["event:71", "person:haran_1407"]));
  });

  it("finds an Entity by alias and says which alias matched", () => {
    expect(data.search("Abram")[0]).toEqual({ id: ABRAHAM, hint: "also called Abram" });
    // Stand-in for "Luz" finds Bethel, which the fixture lacks: Canaan the Place is also called Promised Land.
    expect(data.search("promised")[0]).toEqual({ id: "place:canaan_272", hint: "also called Promised Land" });
  });

  // Stand-ins for "Gen 22:2" and "Genesis 22": the fixture builds Gen 11, 16, 25, 26, 36, Matt 17, and 3 John 1.
  it("finds a Verse by reference", () => {
    expect(data.search("Gen 25:1")).toEqual([{ id: "01025001", hint: "" }]);
    expect(ids("gen 25.1")).toEqual(["01025001"]);
    expect(ids("3 John 1:4")).toEqual(["64001004"]);
  });

  it("finds the first Verse of a chapter by chapter reference", () => {
    expect(data.search("Genesis 16")).toEqual([{ id: "01016001", hint: "first verse of the chapter" }]);
    expect(ids("Matt 17")).toEqual(["40017001"]);
  });

  it("keeps only the chosen type", () => {
    // Fixture: Canaan is a Person, a Place, and part of an Event's title.
    expect(ids("canaan")).toEqual(expect.arrayContaining(["person:canaan_914", "place:canaan_272", "event:71"]));
    expect(ids("canaan", "person")[0]).toBe("person:canaan_914");
    expect(ids("canaan", "place")[0]).toBe("place:canaan_272");
    expect(ids("canaan", "event")[0]).toBe("event:71");
    // Genealogy is a People Group ("Genealogy of Jesus") and a Theme.
    expect(ids("genealogy", "group")).toEqual(["group:genealogy_of_jesus"]);
    expect(ids("genealogy", "theme")[0]).toBe("theme:genealogy");
    expect(ids("Gen 25:1", "verse")).toEqual(["01025001"]);
    expect(ids("abraham", "verse")).toEqual([]);
    for (const type of ["person", "place", "event", "group", "theme"] as const)
      expect(data.search("a", type).every((h) => h.id.startsWith(`${type}:`))).toBe(true);
  });

  it("offers no Verse in a chapter outside the build", () => {
    expect(ids("Gen 22:2")).toEqual([]);
    expect(ids("Exodus 3")).toEqual([]);
  });
});
