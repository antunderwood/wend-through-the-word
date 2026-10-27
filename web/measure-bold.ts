// Measures the names rule for bold (decision 207) on a whole export, to re-run on the next one.
// Prints, for Person and Place mentions, how many Verses bold the node's name with the node's own
// names and aliases (the hit rate), and, over every pair of nodes mentioned in one Verse, the bold
// runs the pair gives that neither node gives alone (added) and those a node gives alone that the
// pair does not (lost), the first 10 of each, or all of them with --all. Names and aliases come from
// the search index, as in the panel (decision 208). Reads the export only.
// Usage, from the repository root: node web/measure-bold.ts out/data/<version> [--all]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { boldNames, type Named } from "./src/bold.ts";

const [root, flag] = process.argv.slice(2);
if (!root) throw new Error("Usage: node web/measure-bold.ts <export data folder of one version> [--all]");
const shown = flag === "--all" ? Infinity : 10;

type Verse = { key: string; label: string; text_bsb?: string; mentions?: { id: string }[] };
const readJSON = (...path: string[]) => JSON.parse(readFileSync(join(root, ...path), "utf8"));
const named = new Map<string, Named>(
  (readJSON("search-index.json").entities as (Named & { id: string })[]).map((e) => [e.id, e]),
);
const verses: Verse[] = readdirSync(join(root, "chapter")).flatMap((book) =>
  readdirSync(join(root, "chapter", book))
    .filter((file) => !file.endsWith(".ring2.json"))
    .flatMap((file) => readJSON("chapter", book, file).verses as Verse[]),
);

// A Verse's bold runs, each as its offset and text.
function boldRuns(text: string, nodes: Named[]): Set<string> {
  const runs = new Set<string>();
  let at = 0;
  for (const r of boldNames(text, nodes)) {
    if (r.bold) runs.add(`${at}:${r.text}`);
    at += r.text.length;
  }
  return runs;
}

const hits: Record<string, { found: number; mentions: number }> = {};
let pairs = 0;
const added: string[] = [];
const lost: string[] = [];
for (const v of verses) {
  const ids = [...new Set((v.mentions ?? []).map((m) => m.id))].filter((id) => named.has(id));
  for (const id of ids) {
    const node = named.get(id)!;
    if (node.type !== "person" && node.type !== "place") continue;
    const count = (hits[node.type] ??= { found: 0, mentions: 0 });
    count.mentions++;
    if (v.text_bsb && boldRuns(v.text_bsb, [node]).size) count.found++;
  }
  if (!v.text_bsb) continue;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      pairs++;
      const [a, b] = [named.get(ids[i])!, named.get(ids[j])!];
      const together = boldRuns(v.text_bsb, [a, b]);
      const alone = new Set([...boldRuns(v.text_bsb, [a]), ...boldRuns(v.text_bsb, [b])]);
      for (const run of together) if (!alone.has(run)) added.push(`${v.label} ${a.name} + ${b.name}: ${run}`);
      for (const run of alone) if (!together.has(run)) lost.push(`${v.label} ${a.name} + ${b.name}: ${run}`);
    }
}

const percent = (n: number, of: number) => `${((100 * n) / of).toFixed(1)} percent`;
for (const [type, { found, mentions }] of Object.entries(hits).sort())
  console.log(`${type}: ${found} of ${mentions} mentions found (${percent(found, mentions)})`);
console.log(`\nPairs of nodes in one Verse: ${pairs}; bold runs added by the pair: ${added.length}, lost: ${lost.length}`);
for (const [title, runs] of [["Added", added], ["Lost", lost]] as const)
  if (runs.length) console.log(`\n${title} (Verse, the two nodes, offset:text):\n${runs.slice(0, shown).join("\n")}`);
