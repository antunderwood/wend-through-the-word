import { describe, expect, it } from "vitest";
import { STEPS, type TourPage } from "../src/tour";

// The step texts read only the view and the pointer.
const texts = (coarse: boolean) => STEPS.map((s) => s.text({ view: "A", coarse } as TourPage));

describe("the tour's wording follows the pointer (decision 182)", () => {
  it("says click and double click with a mouse, as before", () => {
    const t = texts(false);
    expect(t[2]).toContain("Click God to select him");
    expect(t[3]).toContain("click him in the scene or in the Your Path bar");
    expect(t[6]).toContain("Double click Simon Peter in the scene");
    expect(t[7]).toContain("Click him there to select him");
    expect(t[11]).toContain("a click on a Verse there selects it");
  });

  it("says tap and double tap on a touch screen, and never click", () => {
    const t = texts(true);
    expect(t[2]).toContain("Tap God to select him");
    expect(t[3]).toContain("tap him in the scene or in the Your Path bar");
    expect(t[6]).toContain("Double tap Simon Peter in the scene");
    expect(t[7]).toContain("Tap him there to select him");
    expect(t[11]).toContain("a tap on a Verse there selects it");
    expect(t.filter((s) => /click/i.test(s))).toEqual([]);
  });
});
