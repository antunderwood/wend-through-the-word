import { describe, expect, it } from "vitest";
import { START } from "../src/address";
import { createData } from "../src/data";
import { restore } from "../src/session";
import { readExport } from "./fixture";

const data = await createData(readExport, "");
const ISAAC = "person:isaac_616",
  SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348";
const open = (asked: Parameters<typeof restore>[0], kept: Parameters<typeof restore>[1]) => restore(asked, kept, data.known, data.label);

describe("the page opens on", () => {
  it("Abraham, when nothing is kept and the address names no Focus", () => {
    expect(open({}, null)).toMatchObject({ focus: START, selected: START, path: [] });
  });

  it("the Focus kept in this browser, with its Path, when the address names no Focus", () => {
    expect(open({}, { focus: SARAH, path: [START] })).toMatchObject({ focus: SARAH, selected: SARAH, path: [START] });
  });

  it("the address's Focus, which wins; the kept Focus then joins Your Path", () => {
    expect(open({ focus: ISAAC }, { focus: SARAH, path: [START] })).toMatchObject({ focus: ISAAC, path: [START, SARAH] });
  });

  it("the address's selection, pins, filters, and notice", () => {
    const s = open({ focus: ISAAC, selected: HAGAR, pins: [START], filters: { minVotes: 5 }, notice: "Not recognised." }, null);
    expect(s).toMatchObject({ focus: ISAAC, selected: HAGAR, pins: [START], notice: "Not recognised.", path: [START] });
    expect(s.filters.minVotes).toBe(5);
    expect(s.filters.books).toBe("all");
  });

  it("the kept session less any node this build no longer has", () => {
    expect(open({}, { focus: "person:nobody_1", path: [SARAH, "person:nobody_2"] })).toMatchObject({ focus: START, path: [SARAH] });
  });
});
