// The data loader: reads the static export. getJSON(url) is injected (fetch in the browser, files
// in tests). Reads index.json first, then only files under its data_version, so a new build never
// mixes with a cached old one.
import { typeOf, type Curated, type Edge, type Id, type Link, type NodeType, type Rec } from "./model";

export type GetJSON = (url: string) => Promise<unknown>;

// getJSON in the browser: an HTTP error is a failure too.
export const fetchJSON: GetJSON = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

type SearchIndex = {
  entities: { id: Id; type: NodeType; name: string; aliases: string[]; hint?: string; relation?: string }[];
  books: { number: string; osis: string; name: string; chapters: number[] }[];
};
export type Hit = { id: Id; hint: string };
type Sourced = { source: string; licence: string };
export type Fact = Sourced & { name: string; value: string };
// A "Corrected after review" item (decision 75): the field, its upstream value, and the fix.
export type Correction = Curated & { field: string; was: string; value: string };
type EntityFile = Sourced & {
  name?: string;
  title?: string;
  aliases?: string[];
  gender?: string;
  event_year?: number;
  lat?: number;
  lon?: number;
  coord_source?: string;
  dictionary_entry?: Sourced & { text: string };
  corrections?: Correction[];
  neighbours: Link[];
  verses: (Sourced & { key: string; edge: string; direction: Edge["direction"]; weight: number })[];
  ring2: Rec["ring2"];
};
type Credits = { licence: string; sources: (Sourced & { name: string })[] };
// A Place's coord_source, as credits.json names it. A "Curated" point is not there: it has the
// licence of the data itself.
const POINT_SOURCE: Record<string, string> = { OpenBible: "OpenBible.info Bible Geocoding Data", Pleiades: "Pleiades", Wikidata: "Wikidata", GeoNames: "GeoNames" };
// Theographic's years are astronomical: 0 is 1 BC.
const year = (y: number) => (y > 0 ? `AD ${y}` : `${1 - y} BC`);
const degrees = (x: number, plus: string, minus: string) => `${+Math.abs(x).toFixed(4)}° ${x < 0 ? minus : plus}`;
type Mention = { id: Id; edge: string; weight: number };
type ChapterFile = {
  verses: { key: string; text_bsb?: string; mentions: Mention[]; filed_under: Mention[]; cross_references: Link[] }[];
};

export type Data = Awaited<ReturnType<typeof createData>>;

const KIN = new Set(["PARENT_OF", "SPOUSE_OF", "SIBLING_OF", "HALF_SIBLING_OF"]);

export async function createData(getJSON: GetJSON, root: string) {
  // A failed fetch is retried once; a second failure is thrown to the caller and nothing is kept.
  const get = <T>(url: string) => getJSON(url).catch(() => getJSON(url)) as Promise<T>;
  const index = await get<{ data_version: string }>(`${root}/index.json`);
  const base = `${root}/${index.data_version}`;
  const searchIndex = await get<SearchIndex>(`${base}/search-index.json`);
  const entities = new Map(searchIndex.entities.map((e) => [e.id, e]));
  const books = new Map(searchIndex.books.map((b) => [b.number, b]));
  const records = new Map<Id, Rec>();
  const files = new Map<Id, EntityFile>(); // for the detail panel
  const pending = new Map<Id, Promise<Rec>>();

  const reference = (id: Id) => `${books.get(id.slice(0, 2))?.osis ?? "?"} ${+id.slice(2, 5)}:${+id.slice(5)}`;
  // A Verse in a chapter outside the build cannot load (a Cross-reference into another book): its
  // note, or "" for any other node.
  const built = searchIndex.books.filter((b) => b.chapters.length).map((b) => b.name).join(", ");
  const outside = (id: Id) =>
    typeOf(id) !== "verse" || books.get(id.slice(0, 2))?.chapters.includes(+id.slice(2, 5))
      ? ""
      : `${reference(id)} is outside this build (${built} only).`;

  // The built chapters in Bible order, as the first 5 digits of their Verse Keys.
  const chapters = searchIndex.books.flatMap((b) => b.chapters.map((c) => `${b.number}${String(c).padStart(3, "0")}`));

  const byWeight =(a: Link, b: Link) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  async function fetchRecord(id: Id): Promise<Rec> {
    const type = typeOf(id);
    if (type === "verse") return fetchVerse(id);
    if (type === "overflow") throw new Error(`No record for ${id}`);
    const d = await get<EntityFile>(`${base}/entity/${type}/${id.slice(type.length + 1)}.json`);
    files.set(id, d);
    const links = [
      ...d.neighbours,
      // Entity to Verse: the weight is the number of other Entities in the Verse.
      ...d.verses.map((v) => ({
        id: v.key,
        type: "verse" as const,
        weight: v.weight,
        edges: [{ edge: v.edge, direction: v.direction, source: v.source, licence: v.licence }],
      })),
    ];
    return { id, type, links: links.sort(byWeight), ring2: d.ring2, gender: d.gender, text: d.dictionary_entry?.text };
  }

  // A Verse becomes a record of the same shape, from its chapter file and the chapter's Ring 2
  // sidecar: Mentions and Filed Under weighted by rarity (decision 121), Cross-references by Votes.
  async function fetchVerse(id: Id): Promise<Rec> {
    if (outside(id)) throw new Error(outside(id));
    const chapter = `${base}/chapter/${books.get(id.slice(0, 2))?.osis}/${+id.slice(2, 5)}`;
    const [c, side] = await Promise.all([get<ChapterFile>(`${chapter}.json`), get<{ ring2: Rec["ring2"] }>(`${chapter}.ring2.json`)]);
    const v = c.verses.find((x) => x.key === id);
    if (!v) throw new Error(`No verse ${id} in ${chapter}.json`);
    const named = [...v.mentions, ...v.filed_under].map((mention) => ({
      id: mention.id,
      type: typeOf(mention.id) as NodeType,
      weight: mention.weight,
      edges: [{ edge: mention.edge, direction: "out" as const }],
    }));
    return { id, type: "verse", links: [...named, ...v.cross_references].sort(byWeight), ring2: side.ring2, text: v.text_bsb };
  }

  function load(id: Id): Promise<Rec> {
    const done = records.get(id);
    if (done) return Promise.resolve(done);
    if (!pending.has(id)) {
      const p = fetchRecord(id)
        .then((r) => (records.set(id, r), r))
        .finally(() => pending.delete(id));
      pending.set(id, p);
    }
    return pending.get(id)!;
  }

  // Search over names, aliases, and verse references (decision 22: no verse text search in v1).
  // Matches rank exact, then prefix, then word start, then anywhere, a name before an alias in each;
  // ties go to the shorter name.
  function search(query: string, type?: NodeType): Hit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // "Gen 22:2", "gen 22.2", "Genesis 22", "3 John 1:4": the book is its OSIS name or a prefix of its
    // name (2 letters or more). A chapter alone gives its first Verse. Only built chapters count.
    const ref = q.match(/^((?:[1-3]\s*)?[a-z]+)\.?\s*(\d+)(?:\s*[:.]\s*(\d+))?$/);
    if (ref && (!type || type === "verse")) {
      const [, b, chapter, verse] = ref;
      const s = b.replace(/\s+/g, "");
      const book = searchIndex.books.find((x) => x.osis.toLowerCase() === s || (s.length >= 2 && x.name.toLowerCase().replace(/\s+/g, "").startsWith(s)));
      if (book?.chapters.includes(+chapter))
        return [{ id: `${book.number}${chapter.padStart(3, "0")}${(verse ?? "1").padStart(3, "0")}`, hint: verse ? "" : "first verse of the chapter" }];
    }
    if (type === "verse") return [];
    const rank = (name: string) => {
      const n = name.toLowerCase();
      if (n === q) return 0;
      if (n.startsWith(q)) return 2;
      if (n.split(/\W+/).some((w) => w.startsWith(q))) return 4;
      return n.includes(q) ? 6 : Infinity;
    };
    const hits: (Hit & { score: number; name: string })[] = [];
    for (const e of searchIndex.entities) {
      if (type && e.type !== type) continue;
      const [score, hint] = e.aliases
        .map((a): [number, string] => [rank(a) + 1, `also called ${a}`])
        .reduce((best, hit) => (hit[0] < best[0] ? hit : best), [rank(e.name), ""]);
      if (score < Infinity) hits.push({ id: e.id, hint, score, name: e.name });
    }
    hits.sort((a, b) => a.score - b.score || a.name.length - b.name.length || (a.name < b.name ? -1 : 1));
    return hits.slice(0, 30).map(({ id, hint }) => ({ id, hint }));
  }

  return {
    version: index.data_version,
    load,
    search,
    // Family words (son or daughter, husband or wife) follow the relative's gender, which only the
    // relative's own file carries, so this also loads every Person with a family link. A relative
    // that fails to load keeps the neutral word (child, spouse).
    async loadWithKin(id: Id): Promise<Rec> {
      const r = await load(id);
      const kin = r.links.filter((l) => l.type === "person" && l.edges.some((e) => KIN.has(e.edge)));
      await Promise.allSettled(kin.map((l) => load(l.id)));
      return r;
    },
    // The Verses two Entities are both linked to, in Bible order, with their BSB text.
    async shared(a: Id, b: Id): Promise<{ key: Id; text: string }[]> {
      const [ra, rb] = await Promise.all([load(a), load(b)]);
      const mine = new Set(ra.links.filter((l) => l.type === "verse").map((l) => l.id));
      const keys = rb.links.filter((l) => l.type === "verse" && mine.has(l.id)).map((l) => l.id).sort();
      return Promise.all(keys.map(async (key) => ({ key, text: (await load(key)).text ?? "" })));
    },
    // What the export holds about an Entity beyond its links, each part with its source and licence.
    async details(id: Id) {
      await load(id);
      const d = files.get(id)!;
      const own = { source: d.source, licence: d.licence };
      const facts: Fact[] = [];
      if (d.aliases?.length) facts.push({ name: typeOf(id) === "place" ? "Other names" : "Also called", value: d.aliases.join(", "), ...own });
      if (d.gender) facts.push({ name: "Gender", value: d.gender, ...own });
      if (d.event_year !== undefined) facts.push({ name: "Year", value: `${year(d.event_year)} (approx., Jones chronology)`, ...own });
      if (d.lat !== undefined && d.lon !== undefined) {
        const c = await get<Credits>(`${base}/credits.json`);
        const source = POINT_SOURCE[d.coord_source!] ?? d.coord_source!;
        const licence = c.sources.find((s) => s.name === source)?.licence ?? c.licence;
        facts.push({ name: "Coordinates", value: `${degrees(d.lat, "N", "S")}, ${degrees(d.lon, "E", "W")}`, source, licence });
      }
      return { ...own, facts, entry: d.dictionary_entry, corrections: d.corrections ?? [] };
    },
    outside,
    // The chapter of a built Verse, for the reader panel.
    async chapter(id: Id): Promise<{ title: string; verses: { key: Id; text: string }[] }> {
      const book = books.get(id.slice(0, 2))!;
      const c = await get<ChapterFile>(`${base}/chapter/${book.osis}/${+id.slice(2, 5)}.json`);
      return { title: `${book.name} ${+id.slice(2, 5)}`, verses: c.verses.map((v) => ({ key: v.key, text: v.text_bsb ?? "" })) };
    },
    // The first Verse of the built chapter after (dir 1) or before (dir -1) a Verse's own; none at the ends.
    nextChapter(id: Id, dir: -1 | 1): Id | undefined {
      const c = chapters[chapters.indexOf(id.slice(0, 5)) + dir];
      return c && `${c}001`;
    },
    // An Entity of this build, or a Verse in a built chapter (its verse number is not checked).
    known: (id: Id) => entities.has(id) || (typeOf(id) === "verse" && !outside(id)),
    record: (id: Id) => records.get(id),
    genderOf: (id: Id) => records.get(id)?.gender,
    // The first sentence of a loaded Verse's BSB text or Entity's Dictionary Entry; "" until
    // loaded. The scene wraps it and stops after three lines with an ellipsis.
    quote: (id: Id): string => (records.get(id)?.text ?? "").split(/(?<=\.)\s(?=[A-Z])/)[0],
    // `relation` false leaves out a same-name Person's relation, for a list whose Relationship
    // words already say it.
    label(id: Id, relation = true): string {
      if (typeOf(id) === "verse") return reference(id);
      const e = entities.get(id);
      const name = e?.name ?? id;
      // Nave's headings are upper case ("FAITH"); show them as "Faith".
      const shown =
        typeOf(id) === "theme" && name === name.toUpperCase()
          ? name.toLowerCase().replace(/(^|[\s(,])\S/g, (c) => c.toUpperCase())
          : name;
      // Same-name Entities of one type (decisions 122, 125): "Anah, brother of Ajah (Gen 36:24)".
      const named = relation && e?.relation ? `${shown}, ${e.relation}` : shown;
      return e?.hint ? `${named} (${e.hint})` : named;
    },
  };
}
