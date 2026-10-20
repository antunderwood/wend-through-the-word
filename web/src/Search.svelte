<script lang="ts">
  // Search by name, alias, or verse reference, with a type filter. Choosing a result (a click, or
  // Enter for the first) makes it the Focus at once and closes the list (decision 115).
  import type { Data } from "./data";
  import { TYPE_COLOUR } from "./graph";
  import { TYPES, TYPE_NAME, typeOf, type Id, type NodeType } from "./model";

  // The type colour of the scene, so a result reads like its node.
  const colour = (t: NodeType) => `#${TYPE_COLOUR[t].toString(16).padStart(6, "0")}`;

  let { data, onchoose }: { data: Data; onchoose: (id: Id) => void } = $props();
  let query = $state("");
  let type = $state<NodeType>();
  const hits = $derived(data.search(query, type));

  function choose(id: Id) {
    query = "";
    onchoose(id);
  }
</script>

<div class="search" role="search">
  <input
    type="search"
    aria-label="Search"
    placeholder="Search names, aliases, or a verse (Gen 22:2)"
    autocomplete="off"
    bind:value={query}
    onkeydown={(e) => e.key === "Enter" && hits[0] && choose(hits[0].id)}
  />
  <div class="chips" role="group" aria-label="Filter by type">
    <button aria-pressed={!type} onclick={() => (type = undefined)}>All</button>
    {#each TYPES as t (t)}
      <button aria-pressed={type === t} style="--c: {colour(t)}" onclick={() => (type = t)}>{TYPE_NAME[t]}</button>
    {/each}
  </div>
  {#if query.trim()}
    <ul aria-label="Search results">
      {#each hits as h (h.id)}
        {@const t = typeOf(h.id) as NodeType}
        <li>
          <button onclick={() => choose(h.id)}>
            <span class="name">{data.label(h.id)}</span>
            {#if h.hint}<span class="hint">{h.hint}</span>{/if}
            <span class="type" style="--c: {colour(t)}">{TYPE_NAME[t]}</span>
          </button>
        </li>
      {:else}
        <li class="muted">No match.</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: fixed;
    top: 16px;
    left: 16px;
    width: 300px;
    padding: 8px;
    background: rgba(20, 23, 34, 0.92);
    border: 1px solid #262a3c;
    border-radius: 8px;
  }
  input {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    color: inherit;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #3a4060;
    border-radius: 6px;
    padding: 6px 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .chips button {
    font-size: 11px;
    padding: 2px 9px;
    border-radius: 999px;
    background: none;
    border: 1px solid #3a4060;
    color: #c9ccd8;
  }
  .chips button:hover {
    border-color: var(--c, #6b7394);
  }
  .chips button[aria-pressed="true"] {
    background: var(--c, #ffd27a);
    border-color: var(--c, #ffd27a);
    color: #0d0f17;
    font-weight: 600;
  }
  ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    max-height: 45vh;
    overflow-y: auto;
  }
  li button {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 4px;
    padding: 5px 6px;
    color: #e6e8f0;
  }
  li button:hover,
  li button:focus-visible {
    background: rgba(255, 255, 255, 0.08);
  }
  li:first-child button {
    background: rgba(255, 210, 122, 0.08);
  }
  .name {
    flex: 1;
    min-width: 0;
  }
  .hint {
    color: #9aa0b4;
    font-size: 11px;
  }
  .type {
    flex: none;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--c);
  }
  li.muted {
    padding: 4px 6px;
  }
  .muted {
    color: #9aa0b4;
    font-size: 12px;
  }
</style>
