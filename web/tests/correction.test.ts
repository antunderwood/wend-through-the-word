import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { correctionEmail, correctionLink, KINDS, type CorrectionRequest } from "../src/correction";
import { createData } from "../src/data";
import { readExport } from "./fixture";

const data = await createData(readExport, "");
// The repository comes from credits.json's curated tables link, not from a constant.
const { curated_tables: tables } = await data.credits();
const FORM = "https://github.com/antunderwood/wend-through-the-word/issues/new?template=correction-request.yml";
const PAGE = "https://example.org/?focus=person:anah_247&sel=person:beeri_432";
const ask = (kind: keyof typeof KINDS, nodeIds: string[], currentValue: string) =>
  correctionLink(tables, { kind, nodeIds, currentValue, dataVersion: data.version, pageUrl: PAGE });
const TAIL = "&data_version=test1&page_url=https%3A%2F%2Fexample.org%2F%3Ffocus%3Dperson%3Aanah_247%26sel%3Dperson%3Abeeri_432";

describe("the correction link", () => {
  it("fills the form for a node", () => {
    expect(ask("fact", ["person:anah_247"], "Person: Anah, son of Zibeon (Gen 36:2)")).toBe(
      FORM +
        "&kind=An%20entity%20fact%20(for%20example%2C%20gender%2C%20name%2C%20aliases%2C%20place%2C%20or%20year)" +
        "&node_ids=person%3Aanah_247&current_value=Person%3A%20Anah%2C%20son%20of%20Zibeon%20(Gen%2036%3A2)" +
        TAIL,
    );
  });

  it("names both nodes of a Relationship", () => {
    expect(ask("relationship", ["person:anah_247", "person:beeri_432"], "Beeri: possibly the same person as Anah")).toBe(
      FORM +
        "&kind=A%20relationship%20(for%20example%2C%20a%20wrong%20or%20missing%20family%20link)" +
        "&node_ids=person%3Aanah_247%2C%20person%3Abeeri_432&current_value=Beeri%3A%20possibly%20the%20same%20person%20as%20Anah" +
        TAIL,
    );
  });

  it("fills the form for a fact", () => {
    expect(ask("fact", ["person:anah_247"], "Gender: Male")).toContain("&node_ids=person%3Aanah_247&current_value=Gender%3A%20Male&data_version=");
  });

  it("names the Entity and the Verse of a linked Verse", () => {
    expect(ask("verse", ["person:anah_247", "01036024"], "Anah: named in this verse (Gen 36:24)")).toBe(
      FORM +
        "&kind=A%20verse%20link%20(for%20example%2C%20a%20verse%20names%20someone%20but%20has%20no%20link)" +
        "&node_ids=person%3Aanah_247%2C%2001036024&current_value=Anah%3A%20named%20in%20this%20verse%20(Gen%2036%3A24)" +
        TAIL,
    );
  });

  it("uses the form's own field IDs and options", async () => {
    const form = await readFile(new URL("../../.github/ISSUE_TEMPLATE/correction-request.yml", import.meta.url), "utf8");
    for (const id of ["kind", "node_ids", "current_value", "data_version", "page_url"]) expect(form).toContain(`id: ${id}\n`);
    for (const option of Object.values(KINDS)) expect(form).toContain(`- ${option}\n`);
  });
});

describe("the correction email", () => {
  const request: CorrectionRequest = { kind: "fact", nodeIds: ["person:anah_247"], currentValue: "Gender: Male", dataVersion: data.version, pageUrl: PAGE };

  it("writes to the project address with the form's fields in its body", () => {
    const email = new URL(correctionEmail(request));
    expect(email.protocol + email.pathname).toBe("mailto:contact@wendtheword.flying-ant.uk");
    expect(email.searchParams.get("subject")).toBe("Correction: Gender: Male");
    expect(email.searchParams.get("body")).toBe(
      [
        "What is wrong? An entity fact (for example, gender, name, aliases, place, or year)",
        "Node IDs: person:anah_247",
        "What the app shows now: Gender: Male",
        "What it should be:",
        "Evidence verses (at least one, and what each shows):",
        "Data version: test1",
        "Page URL: https://example.org/?focus=person:anah_247&sel=person:beeri_432",
        "",
        "By submitting, you agree that your suggestion may be included in the dataset under CC BY-SA 4.0.",
      ].join("\r\n"),
    );
  });

  it("has every field the form link fills, with the same value", () => {
    const link = new URL(correctionLink(tables, request)).searchParams;
    const body = new URL(correctionEmail(request)).searchParams.get("body")!;
    for (const id of ["kind", "node_ids", "current_value", "data_version", "page_url"]) expect(body).toContain(link.get(id));
  });
});
