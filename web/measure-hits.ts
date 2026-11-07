// Runs the bold rule (web/src/bold.ts, decision 207) as it ships on (Verse, node) pairs given on
// stdin by pipeline/acai_words.py, and prints the pairs it bolds the node's name in, as JSON.
// Input: {nodes: {id: {type, name, aliases}}, pairs: [[verseKey, id], ...], texts: {verseKey: text}}
import { readFileSync } from "node:fs";
import { boldNames, type Named } from "./src/bold.ts";

const { nodes, pairs, texts } = JSON.parse(readFileSync(0, "utf8")) as {
  nodes: Record<string, Named>;
  pairs: [string, string][];
  texts: Record<string, string>;
};
const hits = pairs.filter(([key, id]) => {
  const text = texts[key];
  return text !== undefined && nodes[id] !== undefined && boldNames(text, [nodes[id]]).some((r) => r.bold);
});
console.log(JSON.stringify(hits));
