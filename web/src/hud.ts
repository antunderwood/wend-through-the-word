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
