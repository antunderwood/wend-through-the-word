import type { Page } from "@playwright/test";

// The browser tests read the drawn scene through window.wendGraph, set only in the e2e build.
export type OnScreen = { id: string; role: string; x: number; y: number };
declare global {
  interface Window {
    wendGraph?: { testNodes(): OnScreen[] };
  }
}

// Every drawn node with its position on the page.
export const nodes = (page: Page) => page.evaluate(() => window.wendGraph!.testNodes());
// Waits for a frame drawn with id as the Focus.
export const focusIs = (page: Page, id: string) =>
  page.waitForFunction((id) => window.wendGraph?.testNodes().find((n) => n.role === "focus")?.id === id, id, { polling: "raf" });
