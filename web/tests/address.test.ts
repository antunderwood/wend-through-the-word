import { describe, expect, it } from "vitest";
import { read as readAddress, START, write as writeAddress } from "../src/address";
import { createData } from "../src/data";
import { initialState, type State, type View } from "../src/model";
import { readExport } from "./fixture";

const data = await createData(readExport, "");
const ISAAC = "person:isaac_616";
// Fixture: Genesis, Matthew, and 3 John are built.
const read = (search: string) => readAddress(search, data.exists, data.builtBooks.map((b) => b.osis), data.verseKey);
const write = (s: State, view: View, share = false) => writeAddress(s, view, data.osis, share);

describe("the page address", async () => {
  const shared: State = {
    ...initialState(ISAAC),
    selected: "01025001",
    pins: [START, "place:beer-lahai-roi_167", "64001004"],
    filters: { ...initialState(ISAAC).filters, minVotes: 5, hidden: ["event", "theme"], books: ["Gen", "3John"] },
  };

  it("reads back what it wrote", async () => {
    expect(await read(write(shared, "B"))).toEqual({
      focus: ISAAC,
      selected: "01025001",
      pins: shared.pins,
      filters: { minVotes: 5, hidden: ["event", "theme"], books: ["Gen", "3John"] },
      view: "B",
    });
    const build: State = { ...shared, filters: { ...shared.filters, books: "build" } };
    expect((await read(write(build, "B"))).filters?.books).toBe("build");
  });

  it("keeps IDs readable: colons and commas are not escaped, and a Verse is its OSIS reference", async () => {
    expect(write(shared, "B")).toBe(
      "?focus=person:isaac_616&sel=Gen.25.1&pins=person:abraham_58,place:beer-lahai-roi_167,3John.1.4&view=B&votes=5&hide=event,theme&books=Gen,3John",
    );
    expect(write(initialState("01016001"), "A")).toBe("?focus=Gen.16.1");
  });

  it("leaves defaults out, so Abraham with default settings is the bare address", async () => {
    expect(write(initialState(START), "A")).toBe("");
    expect(await read("")).toEqual({});
    // The Selected Node is left out when it is the Focus.
    expect(write(initialState(ISAAC), "A")).toBe("?focus=person:isaac_616");
  });

  it("names the Focus in a shared link, even Abraham with default settings", () => {
    expect(write(initialState(START), "A", true)).toBe("?focus=person:abraham_58");
    expect(write(shared, "B", true)).toBe(write(shared, "B"));
  });

  it("drops unknown IDs, unknown views, and non-numeric votes with a notice", async () => {
    expect(await read("?focus=person:nobody_1&sel=place:nowhere_2&pins=person:nobody_3,person:isaac_616&view=D&votes=many")).toEqual({
      pins: [ISAAC],
      notice: "Not recognised in this link, so left out: focus person:nobody_1, sel place:nowhere_2, pins person:nobody_3, view D, votes many.",
    });
  });

  it("drops unknown node types and books not in this build with a notice", async () => {
    expect(await read("?hide=theme,angel&books=Gen,Exod")).toEqual({
      filters: { hidden: ["theme"], books: ["Gen"] },
      notice: "Not recognised in this link, so left out: hide angel, books Exod.",
    });
  });

  it("reads a Verse as its OSIS reference, its Verse Key, or any form the search box accepts", async () => {
    for (const v of ["Gen.25.1", "01025001", "Gen 25:1", "Gen25:1", "Genesis 25:1", "gen 25.1"])
      expect(await read(`?focus=${encodeURIComponent(v)}`)).toEqual({ focus: "01025001" });
    expect(await read("?sel=Gen.16.1&pins=Gen.11.31,01011031,3John.1.4")).toEqual({ selected: "01016001", pins: ["01011031", "64001004"] });
  });

  it("drops a Verse reference outside the build, or whose Verse number its chapter does not have", async () => {
    // Fixture: Gen 22 is not built; Gen 11 is built and ends at verse 32.
    expect(await read("?focus=Gen.22.2&pins=Gen%2011:99,Gen.11.32")).toEqual({
      pins: ["01011032"],
      notice: "Not recognised in this link, so left out: focus Gen.22.2, pins Gen 11:99.",
    });
  });

  it("says how to write a Verse when a value is neither an ID nor a Verse in any form", async () => {
    expect(await read("?focus=0102200")).toEqual({ notice: "0102200 is not a Verse here. Write a Verse as Gen.22.2 or Gen 22:2." });
    expect(await read("?focus=Gen.22.2.&sel=person:nobody_1&pins=Genn.11.31,xyz")).toEqual({
      pins: [],
      notice:
        "Not recognised in this link, so left out: sel person:nobody_1. Gen.22.2., Genn.11.31, xyz are not Verses here. Write a Verse as Gen.22.2 or Gen 22:2.",
    });
  });

  it("drops a Verse outside the build", async () => {
    // Fixture: Gen 22 is not built.
    expect(await read("?focus=01022002")).toEqual({ notice: "Not recognised in this link, so left out: focus 01022002." });
  });

  it("drops a Verse number its built chapter does not have", async () => {
    // Fixture: Gen 11 is built and ends at verse 32.
    expect(await read("?focus=01011099&sel=01011040&pins=01011033,01011032")).toEqual({
      pins: ["01011032"],
      notice: "Not recognised in this link, so left out: focus 01011099, sel 01011040, pins 01011033.",
    });
  });
});
