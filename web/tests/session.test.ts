import { describe, expect, it } from "vitest";
import { START } from "../src/address";
import { createData } from "../src/data";
import { followNotes, restore } from "../src/session";
import { readExport } from "./fixture";

const data = await createData(readExport, "");
const ISAAC = "person:isaac_616",
  SARAH = "person:sarah_2473",
  HAGAR = "person:hagar_1348",
  JESUS = "person:jesus_905";
const open = (asked: Parameters<typeof restore>[0], kept: Parameters<typeof restore>[1]) => restore(asked, kept, data.known, data.label);

describe("the page opens on", () => {
  it("Jesus Christ, when nothing is kept and the address names no Focus (decision 186)", () => {
    expect(open({}, null)).toMatchObject({ focus: JESUS, selected: JESUS, path: [] });
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

describe("a published ID that no longer ships (decision 215)", () => {
  const RENAMED = "theme:sold_birthright", // fixture redirect to theme:birthright
    REMOVED = "person:fixture_removed_9999"; // fixture redirect to nothing
  const follow = data.follow;

  it("is followed to the ID that replaced it, or left out when removed", () => {
    expect(follow(RENAMED)).toBe("theme:birthright");
    expect(follow(REMOVED)).toBeNull();
    expect(follow(SARAH)).toBe(SARAH);
  });

  it("moves the kept Focus and Path steps, drops removed ones, and repeats no step", () => {
    const s = restore({}, { focus: RENAMED, path: [REMOVED, "theme:birthright", SARAH, RENAMED] }, data.known, data.label, follow);
    expect(s).toMatchObject({ focus: "theme:birthright", path: [SARAH] });
  });

  it("moves notes to the new ID, joining any note there, and keeps a removed ID's note", () => {
    const notes = { [RENAMED]: "old", "theme:birthright": "new", [REMOVED]: "kept", [SARAH]: "s" };
    expect(followNotes(notes, follow)).toEqual({ "theme:birthright": "old\n\nnew", [REMOVED]: "kept", [SARAH]: "s" });
  });
});
