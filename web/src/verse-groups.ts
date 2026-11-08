// A long list of Verse Keys split by Testament, then by book (decision 233). Verse Keys start with the
// book's order number, so the groups and their counts come from the keys alone, before any text loads.
import type { Id } from "./model";

export const GROUP_MIN = 8; // fewer Verses than this stay one plain list

export type BookGroup = { number: string; keys: Id[] };
export type TestamentGroup = { id: "ot" | "nt"; name: string; books: BookGroup[]; count: number };

// Books 01 to 39 are the Old Testament, 40 to 66 the New.
export const testamentOf = (key: Id): "ot" | "nt" => (+key.slice(0, 2) <= 39 ? "ot" : "nt");

// The groups of `keys` (in Bible order), or undefined when the list is better left plain: under
// GROUP_MIN Verses, or all in one book.
export function groupKeys(keys: readonly Id[]): TestamentGroup[] | undefined {
  if (keys.length < GROUP_MIN) return undefined;
  const books: BookGroup[] = [];
  for (const key of keys) {
    const number = key.slice(0, 2);
    const last = books[books.length - 1];
    if (last?.number === number) last.keys.push(key);
    else books.push({ number, keys: [key] });
  }
  if (books.length < 2) return undefined;
  return (["ot", "nt"] as const)
    .map((id) => {
      const mine = books.filter((b) => testamentOf(b.keys[0]) === id);
      return { id, name: id === "ot" ? "Old Testament" : "New Testament", books: mine, count: mine.reduce((n, b) => n + b.keys.length, 0) };
    })
    .filter((t) => t.books.length);
}
