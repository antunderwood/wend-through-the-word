// The HUD: a see-through card over the scene that shows the Selected Node at a glance, an
// alternative to the detail panel on a desktop window. The pure parts live here so they can be
// tested without a browser; Hud.svelte draws them.
import { TYPES, type Link, type NodeType } from "./model";
import { store, stored } from "./storage";

// How the Selected Node is shown on a desktop window: the side panel, or the HUD over the scene.
export type InfoMode = "panel" | "hud";
export const INFO_MODE_KEY = "wend.infoMode";
export const keptInfoMode = (): InfoMode => (stored(INFO_MODE_KEY) === "hud" ? "hud" : "panel");
export const keepInfoMode = (mode: InfoMode) => store(INFO_MODE_KEY, mode);

// The card's outline: a rectangle with its top left and bottom right corners cut off, as points for
// an SVG polygon or a CSS clip-path, inset by `inset` px so a stroke stays inside the box.
export function chamfer(w: number, h: number, cut: number, inset = 0): [number, number][] {
  const c = Math.max(0, Math.min(cut, w / 2, h / 2)),
    i = inset;
  return [
    [i + c, i],
    [w - i, i],
    [w - i, h - i - c],
    [w - i - c, h - i],
    [i, h - i],
    [i, i + c],
  ];
}
export const svgPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");
export const clipPath = (pts: [number, number][]) => `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(", ")})`;

// How many of the node's links are of each type, in the panel's order, leaving out types it has
// none of: the HUD's readout bars.
export function linkCounts(links: Link[]): { type: NodeType; count: number }[] {
  const n = new Map<NodeType, number>();
  for (const l of links) n.set(l.type, (n.get(l.type) ?? 0) + 1);
  return TYPES.filter((t) => n.get(t)).map((type) => ({ type, count: n.get(type)! }));
}

// A readout bar's lit segments out of `of`: at least one for any count, all of them at the largest.
export function segments(count: number, largest: number, of = 10) {
  if (count <= 0 || largest <= 0) return 0;
  return Math.max(1, Math.round((Math.min(count, largest) / largest) * of));
}

// A long list of names cut to the first few, with how many more there are: "Isaac, Israel +3".
export function shortList(value: string, keep = 4) {
  const all = value.split(", ").filter((v, i, a) => a.indexOf(v) === i);
  return all.length <= keep ? all.join(", ") : `${all.slice(0, keep).join(", ")} +${all.length - keep}`;
}

// Where the reader put the HUD and how big they made it, kept in this browser. No place: the card
// sits at its default spot, top right; no h: it is as tall as its content allows.
export type HudPlace = { x: number; y: number; w: number; h?: number };
export const HUD_PLACE_KEY = "wend.hudPlace";
export const HUD_FLICKER_KEY = "wend.hudFlicker";
export const HUD_W = 340;
export const HUD_MIN = { w: 280, h: 220 };
export const HUD_MAX_W = 720;
const EDGE = 8;

export function keptPlace(): HudPlace | null {
  try {
    const p = JSON.parse(stored(HUD_PLACE_KEY) ?? "null");
    return p && [p.x, p.y, p.w].every(Number.isFinite) ? p : null;
  } catch {
    return null;
  }
}
export const keepPlace = (p: HudPlace | null) => store(HUD_PLACE_KEY, JSON.stringify(p));
export const keptFlicker = () => stored(HUD_FLICKER_KEY) === "on";
export const keepFlicker = (on: boolean) => store(HUD_FLICKER_KEY, on ? "on" : "off");

// The place kept whole on a screen of the given size: the card's width and height fit, and at least
// its whole width and its top strip stay on screen, so it can always be dragged back.
export function clampPlace(p: HudPlace, screenW: number, screenH: number): HudPlace {
  const w = Math.round(Math.min(Math.max(p.w, HUD_MIN.w), HUD_MAX_W, screenW - 2 * EDGE));
  const h = p.h === undefined ? undefined : Math.round(Math.min(Math.max(p.h, HUD_MIN.h), screenH - 2 * EDGE));
  const x = Math.round(Math.min(Math.max(p.x, EDGE), screenW - w - EDGE));
  const y = Math.round(Math.min(Math.max(p.y, EDGE), screenH - (h ?? 120) - EDGE));
  return h === undefined ? { x, y, w } : { x, y, w, h };
}
