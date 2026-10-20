// The data loader: reads the static export. getJSON(url) is injected (fetch in the browser, files
// in tests). Reads index.json first, then only files under its data_version, so a new build never
// mixes with a cached old one.
import { typeOf, type Edge, type Id, type Link, type Rec } from "./model";

export type GetJSON = (url: string) => Promise<unknown>;

type SearchIndex = { entities: { id: Id; name: string }[]; books: { number: string; osis: string; chapters: number[] }[] };
type EntityFile = {
  name?: string;
  title?: string;
  gender?: string;
  neighbours: Link[];
  verses: { key: string; edge: string; direction: Edge["direction"]; weight: number }[];
  ring2: Rec["ring2"];
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
    // A Verse Focus comes with the weighted Mentions (#20).
    if (type === "verse" || type === "overflow") throw new Error(`No record for ${id}`);
    const d = await get<EntityFile>(`${base}/entity/${type}/${id.slice(type.length + 1)}.json`);
    const links = [
      ...d.neighbours,
      // Entity to Verse: the weight is the number of other Entities in the Verse.
      ...d.verses.map((v) => ({ id: v.key, type: "verse" as const, weight: v.weight, edges: [{ edge: v.edge, direction: v.direction }] })),
    ];
    return { id, type, links: links.sort(byWeight), ring2: d.ring2, gender: d.gender };
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
