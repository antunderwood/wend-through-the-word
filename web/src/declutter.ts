// Which names fit on screen (decision 124): pure, no DOM, no three.js. A name that would overlap a
// more important one is hidden until a zoom or a camera move makes room.
import type { Id, SceneNode } from "./model";

export type Box = { left: number; top: number; right: number; bottom: number };

// Lower is more important: the Selected Node, the Focus, Pinned Nodes, Ring 1 by rank within each
// type (rank 0 of every type before rank 1), Overflow Nodes, then the names around pins by rank.
export function namePriority(n: SceneNode, selected: Id): number {
  if (n.id === selected) return 0;
  if (n.role === "focus") return 1;
  if (n.role === "pinned") return 3;
  if (n.role === "ring1") return 10 + n.ring1!.pos;
  if (n.role === "overflow") return 1000;
  return 2000 + (n.rank ?? 0);
}
// The Relationship words on the Selected Node's edge come straight after the Focus's name.
export const WORDS_PRIORITY = 2;

// Places names from the most important (lowest priority number) down; each is kept only when it
// overlaps no name already kept. Returns, per name, whether it shows.
export function uncrowded(names: { box: Box; priority: number }[]): boolean[] {
  const kept: Box[] = [];
  const shows = names.map(() => false);
  const order = names.map((_, i) => i).sort((i, j) => names[i].priority - names[j].priority);
  for (const i of order) {
    const b = names[i].box;
    if (kept.some((k) => b.left < k.right && k.left < b.right && b.top < k.bottom && k.top < b.bottom)) continue;
    kept.push(b);
    shows[i] = true;
  }
  return shows;
}
