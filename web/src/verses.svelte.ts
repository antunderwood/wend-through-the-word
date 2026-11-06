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
  rows = $state<VerseRow[]>([]);
  failed = $state<string | undefined>();
  busy = $state(false);
  #id: Id | undefined;
  #data: () => Data;

  // `data` and `id` are read when needed; `id` is read in an effect: a new ID starts a new list, none clears it.
  constructor(data: () => Data, id: () => Id | undefined) {
    this.#data = data;
    $effect(() => {
      const next = id();
      untrack(() => this.#start(next));
    });
  }

  async #start(id: Id | undefined) {
    if (id === this.#id) return;
    [this.#id, this.keys, this.rows, this.failed, this.busy] = [id, undefined, [], undefined, false];
    if (!id) return;
    try {
      const keys = await this.#data().verseKeys(id);
      if (this.#id !== id) return;
      this.keys = keys;
      await this.more();
    } catch (e) {
      if (this.#id === id) this.failed = (e as Error).message;
    }
  }

  // The next page of rows.
  async more() {
    const [id, keys, from] = [this.#id, this.keys, this.rows.length];
    if (!id || !keys || this.busy || from >= keys.length) return;
    this.busy = true;
    try {
      const next = await this.#data().verses(keys.slice(from, from + VERSE_STEP), [id]);
      if (this.#id === id) this.rows = [...this.rows, ...next];
    } catch (e) {
      if (this.#id === id) this.failed = (e as Error).message;
    } finally {
      if (this.#id === id) this.busy = false;
    }
  }
}
