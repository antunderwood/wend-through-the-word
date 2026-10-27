// The names in bold in a shared Verse (#109, decision 207): pure, no DOM, no three.js. Works from
// the shipped names and aliases and the Verse's own text only; the rule and its measured hit rate
// and false bold are in the decision.

// A piece of a Verse's text; the runs joined are the text exactly.
export type Run = { text: string; bold: boolean };
export type Named = { type: string; name: string; aliases?: readonly string[] };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A hyphen and a space are alike between a name's words, the word after either in either case
// ("Baale-judah" is also "Baale Judah").
const key = (name: string) => name.replace(/[- ]+(.)/g, (_, c: string) => ` ${c.toLowerCase()}`);
function pattern(name: string): string {
  const [first, ...rest] = name.split(/[- ]+/);
  const word = (w: string) => `[${w[0].toLowerCase()}${w[0].toUpperCase()}]${escape(w.slice(1))}`;
  return [escape(first), ...rest.map(word)].join("[- ]");
}

// The kinds of name, the surest first. A name: a node's name, a phrase, a word in capitals ("LORD").
// A word: a word of a Person's name with no "of" ("Pilate" of "Pontius Pilate"). An alias: a
// single-word alias ("Abram", "Father").
const NAME = 0,
  WORD = 1,
  ALIAS = 2;
const PRONOUN = /^(?:He|Him|His|Himself|Me|My|Mine|Myself|You|Your|Yours|Yourself)$/;

// The names of the Person and Place nodes, each with its surest kind. Only capitalised ones: God's
// alias "last" never bolds.
function names(nodes: readonly Named[]): Map<string, { name: string; kind: number }> {
  const found = new Map<string, { name: string; kind: number }>();
  const add = (name: string, kind: number) => {
    const k = key(name);
    if (/^\p{Lu}/u.test(name) && (found.get(k)?.kind ?? ALIAS + 1) > kind) found.set(k, { name, kind });
  };
  for (const n of nodes) {
    if (n.type !== "person" && n.type !== "place") continue;
    const name = n.name.replace(/ \(.*\)$/, ""); // "Joseph (Husband of Mary)" is Joseph
    add(name, NAME);
    for (const a of n.aliases ?? []) add(a, /[- ]/.test(a) || a === a.toUpperCase() ? NAME : ALIAS);
    const words = name.split(" ");
    if (n.type === "person" && /^\p{Lu}/u.test(name) && words.length > 1 && !words.includes("of"))
      for (const w of words) if (w.length > 1) add(w, WORD);
  }
  return found;
}

// A Verse's BSB text as plain and bold runs, every occurrence of a name of the given nodes in bold
// (only a Person's or a Place's; an Event, a Theme or a People Group bolds nothing).
export function boldNames(text: string, nodes: readonly Named[]): Run[] {
  const found = names(nodes);
  if (!found.size) return text ? [{ text, bold: false }] : [];
  const all = [...found.values()].sort((a, b) => b.name.length - a.name.length).map((n) => pattern(n.name));
  // A possessive is the name's: "David’s", and "Moses’" for a name ending in s.
  const re = new RegExp(`(?<![\\p{L}\\p{N}’'-])(?:${all.join("|")})(?=(’s|(?<=s)’)?(?![\\p{L}\\p{N}-]))`, "gu");
  const matches = [...text.matchAll(re)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length + (m[1]?.length ?? 0),
    kind: found.get(key(m[0]))!.kind,
    word: m[0],
  }));
  // Where any word is capitalised: a Verse's or a sentence's start, or a quotation's.
  const atStart = (i: number) => /(^|[.?!][”’]?\s+|[“‘(])$/.test(text.slice(0, i));
  // The kind of the match over text[from, to), or -1 for none.
  const kindAt = (from: number, to: number) => matches.find((m) => m.start <= from && to <= m.end)?.kind ?? -1;
  const kept = matches.filter((m) => {
    if (m.kind === NAME) return true;
    // An alias at a start is capitalised as any word is there ("Judge for yourselves", a parable's
    // "‘Master, ...").
    if (m.kind === ALIAS && atStart(m.start)) return false;
    // Written in lower case in the same Verse, it is an ordinary word ("Holy: ... a holy place").
    if (new RegExp(`(?<![\\p{L}-])${escape(m.word.toLowerCase())}(?![\\p{L}-])`, "u").test(text)) return false;
    // Next to a capitalised word (not at a start, and not one of the pronouns the BSB capitalises
    // for God: "My Father") that is not a name of the node, across a space or "and", it is part of
    // some other name or title ("King Herod", "the Holy and Righteous One"); an alias next to
    // another alias is a run of titles ("Holy, Holy, Holy").
    const prev = /(?<!\p{L})(\p{Lu}[\p{L}’'-]+)(,? | and )$/u.exec(text.slice(0, m.start));
    const next = /^(,? | and )(\p{Lu}[\p{L}’'-]+)/u.exec(text.slice(m.end));
    const near = [
      prev && !atStart(prev.index) && !PRONOUN.test(prev[1]) && { comma: prev[2] === ", ", kind: kindAt(prev.index, prev.index + prev[1].length) },
      next && { comma: next[1] === ", ", kind: kindAt(m.end + next[1].length, m.end + next[0].length) },
    ];
    return !near.some((w) => w && ((w.kind === -1 && !w.comma) || (w.kind === ALIAS && m.kind === ALIAS)));
  });
  const runs: Run[] = [];
  let at = 0;
  for (const m of kept) {
    if (m.start > at) runs.push({ text: text.slice(at, m.start), bold: false });
    runs.push({ text: text.slice(m.start, m.end), bold: true });
    at = m.end;
  }
  if (at < text.length) runs.push({ text: text.slice(at), bold: false });
  return runs;
}
