// The node type colours, in a module of their own so the splash's graphic, the search results, and
// the filters read like the graph's nodes without importing the graph module, which brings three.js.
import type { NodeType } from "./model";

export const TYPE_COLOUR: Record<NodeType, number> = {
  person: 0x6fa8dc,
  place: 0x6cc4a1,
  event: 0xe6b85c,
  group: 0xb48ee0,
  theme: 0xe0869b,
  verse: 0xa9b1c6,
};
// The type colour as CSS.
export const typeColour = (t: NodeType) => `#${TYPE_COLOUR[t].toString(16).padStart(6, "0")}`;
