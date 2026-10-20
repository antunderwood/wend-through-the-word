import { describe, expect, it } from "vitest";
import { read, START, write } from "../src/address";
import { createData } from "../src/data";
import { initialState, type State } from "../src/model";
import { readExport } from "./fixture";

const data = await createData(readExport, "");
const ISAAC = "person:isaac_616";

describe("the page address", () => {
  const shared: State = {
    ...initialState(ISAAC),
    selected: "01025001",
    pins: [START, "place:beer-lahai-roi_167"],
    filters: { ...initialState(ISAAC).filters, minVotes: 5 },
  };

  it("reads back what it wrote", () => {
    expect(read(write(shared, "B"), data.known)).toEqual({ focus: ISAAC, selected: "01025001", pins: shared.pins, filters: { minVotes: 5 }, view: "B" });
  });

  it("keeps IDs readable: colons and commas are not escaped", () => {
    expect(write(shared, "B")).toBe("?focus=person:isaac_616&sel=01025001&pins=person:abraham_58,place:beer-lahai-roi_167&view=B&votes=5");
  });

  it("leaves defaults out, so Abraham with default settings is the bare address", () => {
    expect(write(initialState(START), "A")).toBe("");
    expect(read("", data.known)).toEqual({});
    // The Selected Node is left out when it is the Focus.
    expect(write(initialState(ISAAC), "A")).toBe("?focus=person:isaac_616");
  });

  it("drops unknown IDs, unknown views, and non-numeric votes with a notice", () => {
    expect(read("?focus=person:nobody_1&sel=place:nowhere_2&pins=person:nobody_3,person:isaac_616&view=D&votes=many", data.known)).toEqual({
      pins: [ISAAC],
      notice: "Not recognised in this link, so left out: focus person:nobody_1, sel place:nowhere_2, pins person:nobody_3, view D, votes many.",
    });
  });

  it("drops a Verse outside the build", () => {
    // Fixture: Gen 22 is not built.
    expect(read("?focus=01022002", data.known)).toEqual({ notice: "Not recognised in this link, so left out: focus 01022002." });
  });
});
