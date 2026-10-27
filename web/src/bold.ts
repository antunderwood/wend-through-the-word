// The names in bold in a shared Verse (#109, decision 207): pure, no DOM, no three.js. Works from
// the shipped names and aliases and the Verse's own text only; the rule and its measured hit rate
// and false bold are in the decision.

// A piece of a Verse's text; the runs joined are the text exactly.
export type Run = { text: string; bold: boolean };
export type Named = { type: string; name: string; aliases?: readonly string[] };

// The kinds of name, the surest first. A name: a node's name, a phrase, a word in capitals ("LORD").
// A word: a word of a Person's name with no "of" ("Pilate" of "Pontius Pilate"). An alias: a
// single-word alias ("Abram", "Father").
type Kind = "name" | "word" | "alias";
const SUREST_FIRST: readonly Kind[] = ["name", "word", "alias"];
// A name to bold, as written in the data, and its kind.
type NodeName = { name: string; kind: Kind };
const PRONOUN = /^(?:He|Him|His|Himself|Me|My|Mine|Myself|You|Your|Yours|Yourself)$/;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A hyphen and a space are alike between a name's words, the word after either in either case
// ("Baale-judah" is also "Baale Judah").
const matchKey = (name: string) => name.replace(/[- ]+(.)/g, (_, c: string) => ` ${c.toLowerCase()}`);
function pattern(name: string): string {
  const [first, ...rest] = name.split(/[- ]+/);
  const anyCase = (word: string) => `[${word[0].toLowerCase()}${word[0].toUpperCase()}]${escape(word.slice(1))}`;
  return [escape(first), ...rest.map(anyCase)].join("[- ]");
}

// A Person's or a Place's names by their match key, each with its surest kind (none for another
// type). Only capitalised ones: God's alias "last" never bolds.
function names(n: Named): Map<string, NodeName> {
  const byKey = new Map<string, NodeName>();
  const add = (name: string, kind: Kind) => {
    const k = matchKey(name);
    const known = byKey.get(k);
    if (/^\p{Lu}/u.test(name) && (!known || SUREST_FIRST.indexOf(kind) < SUREST_FIRST.indexOf(known.kind)))
      byKey.set(k, { name, kind });
  };
  if (n.type !== "person" && n.type !== "place") return byKey;
  // A hyphen or a space at either end joins no words: "Baale-" is Baale.
  const trim = (s: string) => s.replace(/^[- ]+|[- ]+$/g, "");
  const name = trim(n.name.replace(/ \(.*\)$/, "")); // "Joseph (Husband of Mary)" is Joseph
  add(name, "name");
  for (const a of (n.aliases ?? []).map(trim)) add(a, /[- ]/.test(a) || a === a.toUpperCase() ? "name" : "alias");
  const words = name.split(" ");
  if (n.type === "person" && /^\p{Lu}/u.test(name) && words.length > 1 && !words.includes("of"))
    for (const word of words) if (word.length > 1) add(word, "word");
  return byKey;
}

// A Verse's BSB text as plain and bold runs, every occurrence of a name of the given nodes in bold
// (only a Person's or a Place's; an Event, a Theme or a People Group bolds nothing). Each node's
// names are matched and guarded on their own, so another node's name counts as one of this node's
// only where "and" joins the two ("Peter and John" bolds both; "King Herod" keeps Jesus's alias
// "King" plain with Herod in the list too). A word bold for any node is bold; where two nodes'
// names overlap, the earlier wins, then the longer, as one pattern of all the names would match.
export function boldNames(text: string, nodes: readonly Named[]): Run[] {
  const matched = nodes.map((node) => matchNames(text, names(node)));
  const spans = matched
    .flatMap((own, i) => guard(text, own, matched.filter((_, j) => j !== i).flat()))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const runs: Run[] = [];
  let at = 0;
  for (const span of spans) {
    if (span.start < at) continue; // inside or across one already bold
    if (span.start > at) runs.push({ text: text.slice(at, span.start), bold: false });
    runs.push({ text: text.slice(span.start, span.end), bold: true });
    at = span.end;
  }
  if (at < text.length) runs.push({ text: text.slice(at), bold: false });
  return runs;
}

// Where a node's names are written in the text, the longest name first at each place, before any
// guard: each a span text[start, end) with its kind and the words matched.
type Match = { start: number; end: number; kind: Kind; word: string };
function matchNames(text: string, nodeNames: Map<string, NodeName>): Match[] {
  if (!nodeNames.size) return [];
  const all = [...nodeNames.values()].sort((a, b) => b.name.length - a.name.length).map((n) => pattern(n.name));
  // A possessive is the name's: "David’s", and "Moses’" for a name ending in s.
  const re = new RegExp(`(?<![\\p{L}\\p{N}’'-])(?:${all.join("|")})(?=(’s|(?<=s)’)?(?![\\p{L}\\p{N}-]))`, "gu");
  return [...text.matchAll(re)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length + (m[1]?.length ?? 0),
    kind: nodeNames.get(matchKey(m[0]))!.kind,
    word: m[0],
  }));
}

// The matches of one node's names that stay bold, given where the other nodes' names are written.
function guard(text: string, matches: Match[], otherNodes: Match[]): Match[] {
  // Where any word is capitalised: a Verse's or a sentence's start, or a quotation's.
  const atStart = (i: number) => /(^|[.?!][”’]?\s+|[“‘(])$/.test(text.slice(0, i));
  // The kind of the node's match over text[from, to), if any.
  const kindAt = (from: number, to: number) => matches.find((m) => m.start <= from && to <= m.end)?.kind;
  // Whether another node's name is written over text[from, to).
  const otherNodeAt = (from: number, to: number) => otherNodes.some((m) => m.start <= from && to <= m.end);

  // The capitalised word straight before or after a match, across a space, a comma or "and": its
  // kind if it is a name of the node, whether a comma parts them, and whether "and" joins it to the
  // match as another node's name. Before a match, a word at a start and the pronouns the BSB
  // capitalises for God ("My Father") do not count.
  type Neighbour = { kind?: Kind; comma: boolean; andOtherNode: boolean };
  const neighbour = (from: number, to: number, between: string): Neighbour => ({
    kind: kindAt(from, to),
    comma: between === ", ",
    andOtherNode: between === " and " && otherNodeAt(from, to),
  });
  const before = (m: Match): Neighbour | undefined => {
    const wordBefore = /(?<!\p{L})(\p{Lu}[\p{L}’'-]+)(,? | and )$/u.exec(text.slice(0, m.start));
    if (!wordBefore || atStart(wordBefore.index) || PRONOUN.test(wordBefore[1])) return undefined;
    return neighbour(wordBefore.index, wordBefore.index + wordBefore[1].length, wordBefore[2]);
  };
  const after = (m: Match): Neighbour | undefined => {
    const wordAfter = /^(,? | and )(\p{Lu}[\p{L}’'-]+)/u.exec(text.slice(m.end));
    return wordAfter ? neighbour(m.end + wordAfter[1].length, m.end + wordAfter[0].length, wordAfter[1]) : undefined;
  };
  // An alias at a start is capitalised as any word is there ("Judge for yourselves", a parable's
  // "‘Master, ...").
  const aliasAtStart = (m: Match) => m.kind === "alias" && atStart(m.start);
  // Written in lower case in the same Verse, it is an ordinary word ("Holy: ... a holy place").
  const writtenLowerCase = (m: Match) =>
    new RegExp(`(?<![\\p{L}-])${escape(m.word.toLowerCase())}(?![\\p{L}-])`, "u").test(text);
  // Next to a capitalised word that is not a name of the node, across a space or "and" (a comma
  // does not count), it is part of some other name or title ("King Herod", "the Holy and Righteous
  // One"); not where "and" joins it to another node's name, a list ("Peter and John").
  const nextToOtherName = (n: Neighbour) => !n.kind && !n.comma && !n.andOtherNode;
  // An alias next to another alias, across a comma too, is a run of titles ("Holy, Holy, Holy").
  const aliasRun = (m: Match, n: Neighbour) => m.kind === "alias" && n.kind === "alias";
  // A node's name always bolds; a word or an alias only where no guard keeps it plain.
  return matches.filter(
    (m) =>
      m.kind === "name" ||
      !(
        aliasAtStart(m) ||
        writtenLowerCase(m) ||
        [before(m), after(m)].some((n) => n && (nextToOtherName(n) || aliasRun(m, n)))
      ),
  );
}
