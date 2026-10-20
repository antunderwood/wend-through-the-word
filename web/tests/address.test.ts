import { describe, expect, it } from "vitest";
import { read as readAddress, START, write } from "../src/address";
import { createData } from "../src/data";
import { initialState, type State } from "../src/model";
import { readExport } from "./fixture";

const data = await createData(readExport, "");
const ISAAC = "person:isaac_616";
// Fixture: Genesis, Matthew, and 3 John are built.
const read = (search: string) => readAddress(search, data.exists, data.builtBooks.map((b) => b.osis));

describe("the page address", async () => {
  const shared: State = {
    ...initialState(ISAAC),
    selected: "01025001",
    pins: [START, "place:beer-lahai-roi_167"],
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

  it("keeps IDs readable: colons and commas are not escaped", async () => {
    expect(write(shared, "B")).toBe(
      "?focus=person:isaac_616&sel=01025001&pins=person:abraham_58,place:beer-lahai-roi_167&view=B&votes=5&hide=event,theme&books=Gen,3John",
    );
  });

  it("leaves defaults out, so Abraham with default settings is the bare address", async () => {
    expect(write(initialState(START), "A")).toBe("");
    expect(await read("")).toEqual({});
    // The Selected Node is left out when it is the Focus.
    expect(write(initialState(ISAAC), "A")).toBe("?focus=person:isaac_616");
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
