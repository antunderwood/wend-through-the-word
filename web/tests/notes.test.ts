import { describe, expect, it } from "vitest";
import { createData } from "../src/data";
import { initialState, reduce, TYPE_NAME, typeOf, type Id, type NodeType, type State } from "../src/model";
import { notesMarkdown } from "../src/notes";
import { readExport } from "./fixture";

const data = await createData(readExport, "");
const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  ISAAC = "person:isaac_616";
const type = (id: Id) => TYPE_NAME[typeOf(id) as NodeType];
const link = (id: Id) => `https://example.org/?focus=${id}`;
const DATE = new Date(2026, 9, 20);
// Your Path oldest first, then the Focus.
const download = (s: State, notes: Record<Id, string>) => notesMarkdown([...s.path, s.focus], notes, data.label, type, link, DATE);
const visit = (s: State, id: Id) => reduce(s, { type: "focus", id }, data.label);

describe("the notes download", () => {
  it("lists the Focus alone for an empty journey", () => {
    expect(download(initialState(ABRAHAM), {})).toBe(
      "# Journey notes, 20 October 2026\n\n## 1. Abraham\n\n*Person*, [open as the Focus](https://example.org/?focus=person:abraham_58)\n",
    );
  });

  it("lists every step oldest first, ending with the Focus, with a note where there is one", () => {
    const s = visit(visit(initialState(ABRAHAM), SARAH), ISAAC);
    expect(download(s, { [ABRAHAM]: "Called out of Ur.", [ISAAC]: "The son of the promise.\nSee Gen 21." })).toBe(
      [
        "# Journey notes, 20 October 2026",
        "",
        "## 1. Abraham",
        "",
        "*Person*, [open as the Focus](https://example.org/?focus=person:abraham_58)",
        "",
        "Called out of Ur.",
        "",
        "## 2. Sarah",
        "",
        "*Person*, [open as the Focus](https://example.org/?focus=person:sarah_2473)",
        "",
        "## 3. Isaac",
        "",
        "*Person*, [open as the Focus](https://example.org/?focus=person:isaac_616)",
        "",
        "The son of the promise.\nSee Gen 21.",
        "",
      ].join("\n"),
    );
  });

  it("leaves cleared steps out and brings them back with Undo clear, notes and all", () => {
    const s = visit(visit(initialState(ABRAHAM), SARAH), ISAAC);
    const notes = { [SARAH]: "Laughed." };
    const cleared = reduce(s, { type: "clearPath" }, data.label);
    expect(download(cleared, notes)).toBe(
      "# Journey notes, 20 October 2026\n\n## 1. Isaac\n\n*Person*, [open as the Focus](https://example.org/?focus=person:isaac_616)\n",
    );
    expect(download(reduce(cleared, { type: "undoClear" }, data.label), notes)).toBe(download(s, notes));
    expect(download(s, notes)).toContain("## 2. Sarah\n\n*Person*, [open as the Focus](https://example.org/?focus=person:sarah_2473)\n\nLaughed.\n");
  });

  it("names a Verse by its reference", () => {
    expect(download(visit(initialState(ABRAHAM), "01025001"), {})).toContain("## 2. Gen 25:1\n\n*Verse*, [open as the Focus](https://example.org/?focus=01025001)\n");
  });
});
