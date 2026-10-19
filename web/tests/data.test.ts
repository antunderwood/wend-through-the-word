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
});
