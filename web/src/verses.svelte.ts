// An Entity's own Verses with their text, loaded a page at a time (decision 223): the Focus is
// linked to up to thousands of Verses in many chapter files, so its list cannot load at once as a
// shared list does.
import { untrack } from "svelte";
import type { Term } from "./bold";
import type { Data } from "./data";
import type { Id } from "./model";

export const VERSE_STEP = 20;

export type VerseRow = { key: Id; text: string; terms: Term[] };

export class OwnVerses {
  keys = $state<Id[] | undefined>();
  // Loaded rows by Verse Key. A flat list shows the first `shown` keys; a grouped one (decision 233) asks
  // for the keys of the books the reader opens, so rows load in any order.
  cache = $state<Record<Id, VerseRow>>({});
  shown = $state(0);
  failed = $state<string | undefined>();
  busy = $state(false);
  #id: Id | undefined;
  #data: () => Data;
  #first: number;
  #asked = new Set<Id>();
  #running = 0;

  // `data` and `id` are read when needed; `id` is read in an effect: a new ID starts a new list, none clears it.
  // `first` rows load at once, then VERSE_STEP more at a time.
  constructor(data: () => Data, id: () => Id | undefined, first = VERSE_STEP) {
    this.#data = data;
    this.#first = first;
    $effect(() => {
      const next = id();
      untrack(() => this.#start(next));
    });
  }

  // The rows of the first `shown` keys that have loaded, in Bible order.
  get rows(): VerseRow[] {
    return (this.keys ?? []).slice(0, this.shown).flatMap((k) => this.cache[k] ?? []);
  }

  async #start(id: Id | undefined) {
    if (id === this.#id) return;
    [this.#id, this.keys, this.cache, this.shown, this.failed, this.busy] = [id, undefined, {}, 0, undefined, false];
    this.#asked = new Set();
    this.#running = 0;
    if (!id) return;
    try {
      const keys = await this.#data().verseKeys(id);
      if (this.#id !== id) return;
      this.keys = keys;
      await this.more(this.#first);
    } catch (e) {
      if (this.#id === id) this.failed = (e as Error).message;
    }
  }

  // Loads the text of these keys, those not already asked for.
  async ensure(keys: Id[]) {
    const id = this.#id;
    const todo = keys.filter((k) => !this.#asked.has(k));
    if (!id || !todo.length) return;
    todo.forEach((k) => this.#asked.add(k));
    this.busy = ++this.#running > 0;
    try {
      const next = await this.#data().verses(todo, [id]);
      if (this.#id === id) for (const r of next) this.cache[r.key] = r;
    } catch (e) {
      if (this.#id === id) {
        todo.forEach((k) => this.#asked.delete(k));
        this.failed = (e as Error).message;
      }
    } finally {
      if (this.#id === id) this.busy = --this.#running > 0;
    }
  }

  // The next page of rows in the flat list.
  async more(step = VERSE_STEP) {
    const [keys, from] = [this.keys, this.shown];
    if (!this.#id || !keys || this.busy || from >= keys.length) return;
    this.shown = Math.min(keys.length, from + step);
    await this.ensure(keys.slice(from, this.shown));
  }
}
