// The detail panel's width on a desktop window, which the reader sets by dragging its left edge
// (decision 225). The pure parts live here so they can be tested without a browser; App.svelte
// draws the handle.
import { store, stored } from "./storage";

export const PANEL_W_KEY = "wend.panelW";
// The panel's default width, and the reader drawer's width with its two gutters: --panel-w,
// --reader-w and --gutter in tokens.css.
export const PANEL_W = 340;
const DRAWER = 380 + 2 * 16;
export const PANEL_MIN = 280;
export const PANEL_MAX = 720;
// The least of the scene a wide panel may leave; a panel no wider than the default never gives way,
// so the layout without a kept width is as it was.
export const STAGE_MIN = 360;

// The width kept in this browser, or null for the default.
export function keptPanelWidth(): number | null {
  const w = Number(stored(PANEL_W_KEY) || NaN);
  return Number.isFinite(w) ? w : null;
}
export const keepPanelWidth = (w: number | null) => store(PANEL_W_KEY, w === null ? "" : String(Math.round(w)));

// The width the panel takes on a window `screenW` px wide, the reader drawer open or not: within
// PANEL_MIN and PANEL_MAX, and no wider than leaves STAGE_MIN of the scene, unless that is less than
// the default.
export function fitPanelWidth(w: number, screenW: number, reading: boolean): number {
  const room = screenW - (reading ? DRAWER : 0) - STAGE_MIN;
  return Math.round(Math.max(PANEL_MIN, Math.min(w, PANEL_MAX, Math.max(PANEL_W, room))));
}
