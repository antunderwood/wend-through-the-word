import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Module boundaries (spec, user stories 63 and 64): the import lines of each module.
const imports = (file: string) =>
  [...readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8").matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);

describe("module boundaries", () => {
  it("keeps the Focus Model free of the DOM, three.js, and Svelte", () => {
    expect(imports("model.ts")).toEqual([]);
    expect(readFileSync(new URL("../src/model.ts", import.meta.url), "utf8")).not.toMatch(/\b(document|window)\b/);
  });

  it("keeps Svelte out of the graph module and the views", () => {
    for (const file of ["graph.ts", "views/view.ts", "views/a.ts"]) expect(imports(file).filter((m) => m.startsWith("svelte"))).toEqual([]);
  });
});
