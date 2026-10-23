import type { Page } from "@playwright/test";

// The browser tests read the drawn scene through window.wendGraph, set only in the e2e build, and
// can act on the Focus Model through window.wendApply, for a state no control sets (a low node limit).
export type OnScreen = { id: string; role: string; x: number; y: number };
declare global {
  interface Window {
    wendGraph?: { testNodes(): OnScreen[]; nodeRect(id: string): DOMRect | null; panTo(id: string, x: number, y: number, zoomOut?: number): void; setView(v: string): void };
    wendApply?: (a: import("../src/model").Action) => void;
  }
}

// A first visit opens on Jesus Christ (decision 186); the specs written around Abraham open on him as
// a reader would who left off there: Abraham kept as the Focus in this browser, with an empty Your
// Path. Only the first load sets it, so a reload restores what the page itself kept since.
export async function openOnAbraham(page: Page, path = "/") {
  await page.addInitScript(
    () => localStorage.getItem("wend.journey") || localStorage.setItem("wend.journey", JSON.stringify({ focus: "person:abraham_58", path: [] })),
  );
  await page.goto(path);
}
// Every drawn node with its position on the page.
export const nodes = (page: Page) => page.evaluate(() => window.wendGraph!.testNodes());
// Waits for a frame drawn with id as the Focus.
export const focusIs = (page: Page, id: string) =>
  page.waitForFunction((id) => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id === id, id, { polling: "raf" });
// How many Themes are drawn, their Overflow Node included.
export const themesOnScreen = async (page: Page) => (await nodes(page)).filter((n) => /^(overflow:)?theme/.test(n.id)).length;
// A double click on a node's label, not its disc: in the tilted plane Abraham's label lies over
// Hagar's disc once the next frame draws it. The label waits for that frame and fails if anything
// covers it. Then waits for id to be the Focus.
export async function doubleClickLabel(page: Page, name: string, id: string) {
  await page.locator(".labels").getByText(name, { exact: true }).dblclick();
  await focusIs(page, id);
}
