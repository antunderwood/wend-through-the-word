<script lang="ts">
  // Search by name, alias, or verse reference, with a type filter. Choosing a result (a click, or
  // Enter for the first) makes it the Focus at once and closes the list (decision 115).
  import type { Data } from "./data";
  import { TYPES, TYPE_NAME, typeOf, type Id, type NodeType } from "./model";

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
      <button aria-pressed={type === t} onclick={() => (type = t)}>{TYPE_NAME[t]}</button>
    {/each}
  </div>
  {#if query.trim()}
    <ul aria-label="Search results">
      {#each hits as h (h.id)}
        <li>
          <button onclick={() => choose(h.id)}>
            {data.label(h.id)} <span class="muted">{TYPE_NAME[typeOf(h.id) as NodeType]}{h.hint ? `, ${h.hint}` : ""}</span>
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
  .chips button {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 999px;
  }
  .chips button[aria-pressed="true"] {
    background: #3a4060;
  }
  ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    max-height: 45vh;
    overflow-y: auto;
  }
  li button {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 4px 6px;
  }
  li button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  li.muted {
    padding: 4px 6px;
  }
  .muted {
    color: #9aa0b4;
    font-size: 12px;
  }
</style>
