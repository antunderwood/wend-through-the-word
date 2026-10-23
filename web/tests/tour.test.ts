import { describe, expect, it } from "vitest";
import { makeRoom, spotFor, STEPS, tallest, type TourPage } from "../src/tour";

// Where the box goes (decision 187), on a 325 x 600 phone: the area the box may use is the screen
// less 8 px at each edge, and the scene starts below the 40 px top bar.
const rect = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });
const PHONE = rect(8, 8, 317, 592),
  SCENE = rect(8, 48, 317, 592),
  BOX = { w: 309, h: 200 };

describe("the tour box keeps clear of the step's node and target", () => {
  it("goes below the node when there is room", () => {
    expect(spotFor(BOX, [rect(140, 100, 190, 160)], PHONE, 14)).toEqual([8, 174]);
  });

  it("keeps clear of the node as well as a ring elsewhere: a Your Path chip at the top", () => {
    const chip = rect(10, 10, 110, 34),
      node = rect(140, 60, 190, 120);
    // Below the chip would cover the node; below the node clears both.
    expect(spotFor(BOX, [chip, node], PHONE, 14)).toEqual([8, 134]);
  });

  it("finds no place when the node sits in the middle of a scene too short for the box beside it", () => {
    const short = rect(8, 8, 317, 400);
    expect(spotFor(BOX, [rect(140, 150, 190, 250)], short, 14)).toBeUndefined();
  });

  it("then puts the box at an edge and leaves the largest room in the scene for the node", () => {
    const short = rect(8, 8, 317, 400),
      scene = rect(8, 48, 317, 400);
    // At the top the box leaves 400 - 222 = 178 px below it; at the bottom, 186 - 48 = 138 px above.
    expect(makeRoom(BOX, rect(140, 150, 190, 250), [], short, scene, 14)).toEqual({ spot: [8, 8], room: rect(8, 222, 317, 400) });
  });

  it("keeps the box clear of a ring elsewhere when it makes room", () => {
    const short = rect(8, 8, 317, 400),
      scene = rect(8, 48, 317, 400),
      chip = rect(10, 10, 110, 34);
    // The chip is at the top, so the box goes just below it and the room is below the box.
    expect(makeRoom(BOX, rect(140, 150, 190, 250), [chip], short, scene, 14)).toEqual({ spot: [8, 48], room: rect(8, 262, 317, 400) });
  });
});

// The Recentre button below the top bar, and the search panel open over the top of the scene.
const RECENTRE = rect(8, 48, 52, 92);

describe("the tour box is never taller than the room clear of the Recentre button and an open search", () => {
  it("as wide as an upright phone with the sheet open, it fits the band below the button", () => {
    // The area ends 8 px above the sheet at 324; the band starts 14 px below the button.
    expect(tallest(309, [RECENTRE], rect(8, 8, 317, 316), 14)).toBe(316 - 106);
  });

  it("left of the side sheet, it goes beside the button and keeps the whole height", () => {
    expect(tallest(280, [RECENTRE], rect(8, 8, 432, 322), 14)).toBe(322 - 8);
  });

  it("with search open over the top of the scene, it fits the band below the search panel", () => {
    expect(tallest(280, [RECENTRE, rect(8, 8, 432, 160)], rect(8, 8, 432, 322), 14)).toBe(322 - 174);
  });

  it("with nothing to keep clear of, it has the whole area", () => {
    expect(tallest(300, [], rect(8, 8, 1272, 712), 14)).toBe(704);
  });
});

// The step texts read only the view and the pointer.
const texts = (coarse: boolean) => STEPS.map((s) => s.text({ view: "A", coarse } as TourPage));

describe("the tour's wording follows the pointer (decision 182)", () => {
  it("says click and double click with a mouse, as before", () => {
    const t = texts(false);
    expect(t[2]).toContain("Click God to select him");
    expect(t[3]).toContain("click him in the scene or in the Your Path bar");
    expect(t[6]).toContain("Double click Simon Peter in the scene");
    expect(t[7]).toContain("Click him in the scene or in the Your Path bar to select him");
    expect(t[11]).toContain("a click on a Verse there selects it");
  });

  it("says tap and double tap on a touch screen, and never click", () => {
    const t = texts(true);
    expect(t[2]).toContain("Tap God to select him");
    expect(t[3]).toContain("tap him in the scene or in the Your Path bar");
    expect(t[6]).toContain("Double tap Simon Peter in the scene");
    expect(t[7]).toContain("Tap him in the scene or in the Your Path bar to select him");
    expect(t[11]).toContain("a tap on a Verse there selects it");
    expect(t.filter((s) => /click/i.test(s))).toEqual([]);
  });
});
