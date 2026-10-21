<script lang="ts">
  // The filter panel (PRD 10.1 item 5), a popover opened from the Filters button: node types, the
  // Vote Limit, the book filter (decision 130), and animation.
  import { typeColour as colour } from "./graph";
  import { TYPES, TYPE_PLURAL, type NodeType, type State } from "./model";

  type Filters = State["filters"];
  let {
    filters,
    entityFocus,
    books,
    motion,
    set,
    setMotion,
  }: {
    filters: Filters;
    entityFocus: boolean;
    books: { osis: string; name: string }[];
    motion: boolean;
    set: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
    setMotion: (on: boolean) => void;
  } = $props();

  const show = (t: NodeType, on: boolean) => set("hidden", on ? filters.hidden.filter((x) => x !== t) : [...filters.hidden, t]);
  // One choice at a time: all books, this build only, or one book of the build.
  const chosen = $derived(Array.isArray(filters.books) ? filters.books.join(",") : filters.books);
  const choose = (v: string) => set("books", v === "all" || v === "build" ? v : [v]);
</script>

<div id="filters" class="filters" popover role="dialog" aria-label="Filters">
  <fieldset>
    <legend>Show</legend>
    {#each TYPES as t (t)}
      <label style="--c: {colour(t)}">
        <input type="checkbox" checked={!filters.hidden.includes(t)} onchange={(e) => show(t, e.currentTarget.checked)} />
        {TYPE_PLURAL[t][0].toUpperCase() + TYPE_PLURAL[t].slice(1)}
      </label>
    {/each}
  </fieldset>
  <label class="row">
    Vote Limit: {filters.minVotes}
    <input type="range" min="1" max="25" value={filters.minVotes} oninput={(e) => set("minVotes", +e.currentTarget.value)} />
  </label>
  <p class="muted">
    Votes: how many OpenBible.info readers found this link helpful. It shows popularity, not scholarly strength.
    {#if entityFocus}With an Entity as the Focus, the slider only changes Ring 2.{/if}
  </p>
  <label class="row">
    Verses from
    <select value={chosen} onchange={(e) => choose(e.currentTarget.value)}>
      <option value="all">All books</option>
      <option value="build">This build</option>
      <!-- Only an address can choose several books; the panel chooses one at a time. -->
      {#if Array.isArray(filters.books) && filters.books.length > 1}
        <option value={chosen} disabled>Several books: {books.filter((b) => filters.books.includes(b.osis)).map((b) => b.name).join(", ")}</option>
      {/if}
      {#each books as b (b.osis)}<option value={b.osis}>{b.name}</option>{/each}
    </select>
  </label>
  <label class="row"><input type="checkbox" checked={motion} onchange={(e) => setMotion(e.currentTarget.checked)} /> Animation</label>
</div>

<style>
  .filters {
    inset: auto auto 60px 50%;
    transform: translateX(-50%);
    width: 300px;
    margin: 0;
    padding: 12px 16px;
    background: rgba(20, 23, 34, 0.96);
    color: #e6e8f0;
    border: 1px solid #3a4060;
    border-radius: 8px;
  }
  fieldset {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 12px;
    margin: 0 0 8px;
    padding: 0;
    border: 0;
  }
  legend,
  .muted {
    color: #9aa0b4;
    font-size: 12px;
  }
  fieldset input {
    accent-color: var(--c);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0 0;
  }
  .row input {
    accent-color: #ffd27a;
  }
  .row input[type="range"],
  select {
    flex: 1;
    min-width: 0;
  }
  select {
    font: inherit;
    color: inherit;
    background: #262a3c;
    border: 1px solid #3a4060;
    border-radius: 4px;
  }
  .muted {
    margin: 4px 0 0;
  }
</style>
