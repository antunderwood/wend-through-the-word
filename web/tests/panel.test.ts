import { beforeEach, describe, expect, it } from "vitest";
import { fitPanelWidth, keepPanelWidth, keptPanelWidth, PANEL_MAX, PANEL_MIN, PANEL_W, STAGE_MIN } from "../src/panel";

describe("fitPanelWidth", () => {
  it("keeps a width within its bounds on a wide window", () => {
    expect(fitPanelWidth(500, 1920, false)).toBe(500);
    expect(fitPanelWidth(100, 1920, false)).toBe(PANEL_MIN);
    expect(fitPanelWidth(5000, 1920, false)).toBe(PANEL_MAX);
  });
  it("leaves the scene STAGE_MIN px, the reader drawer counted when it is open", () => {
    expect(fitPanelWidth(700, 1000, false)).toBe(1000 - STAGE_MIN);
    expect(fitPanelWidth(700, 1440, true)).toBe(1440 - 412 - STAGE_MIN);
  });
  it("never squeezes the panel below the default for a lack of room, nor a narrower choice", () => {
    expect(fitPanelWidth(600, 820, true)).toBe(PANEL_W);
    expect(fitPanelWidth(300, 820, true)).toBe(300);
  });
});

describe("the kept width", () => {
  beforeEach(() => keepPanelWidth(null));
  it("is null until set, and again after a reset", () => {
    expect(keptPanelWidth()).toBeNull();
    keepPanelWidth(456.4);
    expect(keptPanelWidth()).toBe(456);
    keepPanelWidth(null);
    expect(keptPanelWidth()).toBeNull();
  });
});
