<!-- A long list of Verses split under Old and New Testament headers that collapse, and a collapsing row
     for each book with its count (decision 233). The counts come from the Verse Keys, which are all known
     before any text loads; a book's text loads when it is opened, a page at a time. The parent draws the
     rows (its own list markup) for the keys that have loaded, so the panel and the HUD share this. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Id } from "./model";
  import type { TestamentGroup } from "./verse-groups";

  let {
    groups,
    bookName,
    ready,
    load,
    list,
    first = 20,
    step = 20,
    hud = false,
    more = "",
  }: {
    groups: TestamentGroup[];
    bookName: (number: string) => string;
    ready: (key: Id) => boolean; // the text of this Verse has loaded
    load: (keys: Id[]) => void; // load the text of these Verses
    list: Snippet<[Id[]]>; // draws the rows of these loaded Verses
    first?: number; // Verses a book shows when opened
    step?: number; // and shows more of at a time
    hud?: boolean;
    more?: string; // before "20 more (5 of 26)", "Show " in the panel
  } = $props();

  // The first book is open at first; the rest wait to be asked for. The parent keys this component by the
  // list it shows, so a new list starts again.
  const firstBook = (() => groups[0]?.books[0]?.number)();
  let shut = $state<Record<string, boolean>>({}); // a testament the reader closed
  let open = $state<Record<string, boolean>>({ [firstBook ?? ""]: true }); // a book the reader opened or closed
  let shown = $state<Record<string, number>>({});

  const isShut = (id: string) => shut[id] ?? id !== groups[0]?.id;
  const count = (book: string, total: number) => Math.min(total, shown[book] ?? first);

  // Every open book in an open testament loads the text of the Verses it shows.
  $effect(() => {
    for (const t of groups) {
      if (isShut(t.id)) continue;
      for (const b of t.books) if (open[b.number]) load(b.keys.slice(0, count(b.number, b.keys.length)));
    }
  });
</script>

<div class="groups" class:hud>
  {#each groups as t (t.id)}
    <h3 class="testament">
      <button aria-expanded={!isShut(t.id)} aria-controls="vg-{t.id}" onclick={() => (shut[t.id] = !isShut(t.id))}>
        <span class="caret" aria-hidden="true">{isShut(t.id) ? "▸" : "▾"}</span>
        <span class="name">{t.name}</span>
        <span class="n">{t.count} verse{t.count === 1 ? "" : "s"}</span>
      </button>
    </h3>
    <div id="vg-{t.id}" hidden={isShut(t.id)}>
      {#each t.books as b (b.number)}
        {@const n = count(b.number, b.keys.length)}
        {@const loaded = b.keys.slice(0, n).filter(ready)}
        <h4 class="book">
          <button aria-expanded={!!open[b.number]} aria-controls="vg-{b.number}" onclick={() => (open[b.number] = !open[b.number])}>
            <span class="caret" aria-hidden="true">{open[b.number] ? "▾" : "▸"}</span>
            <span class="name">{bookName(b.number)}</span>
            <span class="n">{b.keys.length}</span>
          </button>
        </h4>
        <div id="vg-{b.number}" hidden={!open[b.number]}>
          {#if open[b.number]}
            {#if loaded.length}{@render list(loaded)}{:else}<p class="wait">Loading verses…</p>{/if}
            {#if n < b.keys.length}
              <button class="more" onclick={() => (shown[b.number] = n + step)}>{more}{Math.min(step, b.keys.length - n)} more ({n} of {b.keys.length})</button>
            {/if}
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .groups h3,
  .groups h4 {
    margin: 0;
    font: inherit;
    letter-spacing: normal;
    text-transform: none;
    color: inherit;
  }
  .groups h3::after {
    content: none;
  }
  button {
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: 100%;
    padding: 6px 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .testament button {
    margin-top: 8px;
    border-bottom: 1px solid var(--line, #262a3c);
    font-size: var(--fs-sm);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .book button {
    padding-left: 10px;
    color: var(--text-soft, inherit);
  }
  .caret {
    width: 1em;
    color: var(--muted);
  }
  .n {
    margin-left: auto;
    color: var(--muted);
    font-size: var(--fs-sm);
    text-transform: none;
    letter-spacing: normal;
  }
  .more {
    width: auto;
    margin: 4px 0 4px 10px;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .wait {
    margin: 4px 0 4px 10px;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  button:focus-visible {
    outline: 2px solid var(--accent, currentColor);
    outline-offset: 1px;
  }
  /* In the HUD: the terminal look, in its line colour. */
  .hud button {
    font-family: var(--mono);
    color: rgb(var(--hud-ink));
  }
  .hud .testament button {
    border-bottom-color: rgba(var(--hud-line), 0.4);
    font-size: 10px;
    letter-spacing: 0.2em;
    color: rgb(var(--hud-line));
  }
  .hud .n,
  .hud .caret {
    color: rgba(var(--hud-ink), 0.6);
  }
  .hud .more {
    color: rgb(var(--hud-line));
    text-decoration: underline dotted;
  }
</style>
