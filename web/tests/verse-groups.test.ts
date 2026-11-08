import { describe, expect, it } from "vitest";
import { groupKeys, testamentOf } from "../src/verse-groups";

const keys = (...refs: [number, number, number][]) => refs.map(([b, c, v]) => `${String(b).padStart(2, "0")}${String(c).padStart(3, "0")}${String(v).padStart(3, "0")}`);

describe("grouping Verse Keys", () => {
  it("puts books 1 to 39 in the Old Testament and 40 to 66 in the New", () => {
    expect([1, 39, 40, 66].map((b) => testamentOf(keys([b, 1, 1])[0]))).toEqual(["ot", "ot", "nt", "nt"]);
  });

  it("splits a list by Testament, then by book, keeping Bible order and counts", () => {
    const all = keys([1, 12, 1], [1, 12, 2], [1, 22, 1], [2, 3, 6], [19, 105, 9], [44, 7, 2], [45, 4, 3], [45, 4, 9], [58, 11, 8]);
    const groups = groupKeys(all)!;
    expect(groups.map((t) => [t.id, t.name, t.count])).toEqual([["ot", "Old Testament", 5], ["nt", "New Testament", 4]]);
    expect(groups[0].books.map((b) => [b.number, b.keys.length])).toEqual([["01", 3], ["02", 1], ["19", 1]]);
    expect(groups[1].books.map((b) => [b.number, b.keys.length])).toEqual([["44", 1], ["45", 2], ["58", 1]]);
    expect(groups.flatMap((t) => t.books.flatMap((b) => b.keys))).toEqual(all);
  });

  it("omits a Testament with no Verses", () => {
    const groups = groupKeys(keys([1, 1, 1], [1, 1, 2], [1, 1, 3], [2, 1, 1], [2, 1, 2], [3, 1, 1], [3, 1, 2], [4, 1, 1]))!;
    expect(groups.map((t) => t.id)).toEqual(["ot"]);
  });

  it("leaves a short list, or one in a single book, plain", () => {
    expect(groupKeys(keys([1, 1, 1], [40, 1, 1]))).toBeUndefined();
    expect(groupKeys(keys(...Array.from({ length: 9 }, (_, i): [number, number, number] => [1, 1, i + 1])))).toBeUndefined();
  });
});
