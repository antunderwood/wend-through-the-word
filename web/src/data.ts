// The data loader: reads the static export. getJSON(url) is injected (fetch in the browser, files
// in tests). Reads index.json first, then only files under its data_version, so a new build never
// mixes with a cached old one.
import { typeOf, type Edge, type Id, type Link, type NodeType, type Rec } from "./model";

export type GetJSON = (url: string) => Promise<unknown>;

type SearchIndex = { entities: { id: Id; name: string }[]; books: { number: string; osis: string; chapters: number[] }[] };
type EntityFile = {
  name?: string;
  title?: string;
  gender?: string;
  dictionary_entry?: { text: string };
  neighbours: Link[];
  verses: { key: string; edge: string; direction: Edge["direction"]; weight: number }[];
  ring2: Rec["ring2"];
};
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
  const search = await get<SearchIndex>(`${base}/search-index.json`);
  const names = new Map(search.entities.map((e) => [e.id, e.name]));
  const books = new Map(search.books.map((b) => [b.number, b]));
  const records = new Map<Id, Rec>();
  const pending = new Map<Id, Promise<Rec>>();

  const byWeight = (a: Link, b: Link) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  async function fetchRecord(id: Id): Promise<Rec> {
    const type = typeOf(id);
    if (type === "verse") return fetchVerse(id);
    if (type === "overflow") throw new Error(`No record for ${id}`);
    const d = await get<EntityFile>(`${base}/entity/${type}/${id.slice(type.length + 1)}.json`);
    const links = [
      ...d.neighbours,
      // Entity to Verse: the weight is the number of other Entities in the Verse.
      ...d.verses.map((v) => ({ id: v.key, type: "verse" as const, weight: v.weight, edges: [{ edge: v.edge, direction: v.direction }] })),
    ];
    return { id, type, links: links.sort(byWeight), ring2: d.ring2, gender: d.gender, text: d.dictionary_entry?.text };
  }

  // A Verse becomes a record of the same shape, from its chapter file and the chapter's Ring 2
  // sidecar: Mentions and Filed Under weighted by rarity (decision 121), Cross-references by Votes.
  async function fetchVerse(id: Id): Promise<Rec> {
    const chapter = `${base}/chapter/${books.get(id.slice(0, 2))?.osis}/${+id.slice(2, 5)}`;
    const [c, side] = await Promise.all([get<ChapterFile>(`${chapter}.json`), get<{ ring2: Rec["ring2"] }>(`${chapter}.ring2.json`)]);
    const v = c.verses.find((x) => x.key === id);
    if (!v) throw new Error(`No verse ${id} in ${chapter}.json`);
    const named = [...v.mentions, ...v.filed_under].map((m) => ({
      id: m.id,
      type: typeOf(m.id) as NodeType,
      weight: m.weight,
      edges: [{ edge: m.edge, direction: "out" as const }],
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

  return {
    load,
    // Family words (son or daughter, husband or wife) follow the relative's gender, which only the
    // relative's own file carries, so this also loads every Person with a family link. A relative
    // that fails to load keeps the neutral word (child, spouse).
    async loadWithKin(id: Id): Promise<Rec> {
      const r = await load(id);
      const kin = r.links.filter((l) => l.type === "person" && l.edges.some((e) => KIN.has(e.edge)));
      await Promise.allSettled(kin.map((l) => load(l.id)));
      return r;
    },
    rec: (id: Id) => records.get(id),
    genderOf: (id: Id) => records.get(id)?.gender,
    // The first sentence of a loaded Verse's BSB text or Entity's Dictionary Entry, cut at 90
    // characters; "" until loaded.
    quote(id: Id): string {
      const first = (records.get(id)?.text ?? "").split(/(?<=\.)\s(?=[A-Z])/)[0];
      return first.length > 90 ? `${first.slice(0, 88)}...` : first;
    },
    label(id: Id): string {
      if (typeOf(id) === "verse") {
        const b = books.get(id.slice(0, 2));
        return `${b?.osis ?? "?"} ${+id.slice(2, 5)}:${+id.slice(5)}`;
      }
      const name = names.get(id) ?? id;
      // Nave's headings are upper case ("FAITH"); show them as "Faith".
      return typeOf(id) === "theme" && name === name.toUpperCase()
        ? name.toLowerCase().replace(/(^|[\s(,])\S/g, (c) => c.toUpperCase())
        : name;
    },
  };
}
