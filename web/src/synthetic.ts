// Synthetic Scenes for the node limit test page (#30). A made-up Focus has enough Neighbours of
// every type that the real Focus Model, at a node limit of n, draws exactly n nodes; only the K
// differs from a reader's scene, so the mix of roles, labels, and edges follows the real rules.
import { initialState, scene, TYPES, type Link, type Rec, type Scene } from "./model";

export const COUNTS = [100, 250, 500, 750, 1000];
const RING2 = 3, // Ring 2 nodes per Ring 1 node in the Focus Model
  MORE = 5; // Neighbours per type beyond Ring 1, behind the Overflow Node

export function synthetic(n: number): Scene {
  // At K a Scene wants the Focus, 6K Ring 1 nodes, 6 Overflow Nodes, and 18K Ring 2 nodes; the
  // node limit trims the few over n from Ring 2.
  const k = Math.ceil((n - 1 - TYPES.length) / ((1 + RING2) * TYPES.length));
  let made = 0;
  // Every type's IDs read "type:sN", Verses too, so typeOf gives the type and labels show the ID.
  const node = (ti: number) => `${TYPES[ti % TYPES.length]}:s${made++}`;
  const focus = node(0);
  const links: Link[] = TYPES.flatMap((type, ti) =>
    Array.from({ length: k + MORE }, (_, i) => ({
      id: node(ti),
      type,
      weight: k + MORE - i,
      edges: [{ edge: "CO_MENTION", direction: "both" as const, shared_verses: 2 }],
    })),
  );
  const ring2: Rec["ring2"] = {};
  links.forEach((l, i) => (ring2[l.id] = Array.from({ length: RING2 }, (_, r) => ({ id: node(i + r + 1), weight: 1 }))));
  const F: Rec = { id: focus, type: "person", links, ring2 };
  const s = initialState(focus);
  return scene({ ...s, filters: { ...s.filters, k, nodeLimit: n } }, (id) => (id === focus ? F : undefined), () => undefined);
}
