<script lang="ts">
  // Search by name, alias, or verse reference, with a type filter. Choosing a result (a click, or
  // Enter for the first) makes it the Focus at once and closes the list (decision 115). On a desktop
  // the box is a field in the top bar, and the type chips and the results drop below it while the
  // box is in use (decision 210). On a phone
  // search is a button: it opens the box over the top of the scene with the keyboard ready, and the
  // box closes after a choice, on Escape, or on a tap outside it.
  import { tick } from "svelte";
  import type { Data } from "./data";
  import { typeColour as colour } from "./colours";
  import { TYPES, TYPE_NAME, typeOf, type Id, type NodeType } from "./model";
  import { screen } from "./screen.svelte";

  let { data, onchoose }: { data: Data; onchoose: (id: Id) => void } = $props();
  let query = $state("");
  let type = $state<NodeType>();
  const hits = $derived(data.search(query, type));
  let opened = $state(false);
  // On a desktop: the box is in use, so the type chips show below it.
  let active = $state(false);
  const dropped = $derived(screen.phone || active);
  let box = $state<HTMLElement>();
  let input = $state<HTMLInputElement>();

  function choose(id: Id) {
    query = "";
    opened = false;
    active = false;
    onchoose(id);
  }
  async function open() {
    opened = true;
    await tick();
    input!.focus();
  }
  function key(e: KeyboardEvent) {
    if (e.key === "Enter" && hits[0]) choose(hits[0].id);
    else if (e.key === "Escape") opened = active = false;
  }
  // A box left open closes when the layout crosses the phone breakpoint, either way.
  $effect(() => {
    void screen.phone;
    opened = false;
  });
  // A tap anywhere outside the open box closes it.
  function outside(e: PointerEvent) {
    if (!box?.contains(e.target as Node)) opened = active = false;
  }
</script>

<svelte:window onpointerdown={outside} />
{#if screen.phone && !opened}
  <button class="open" data-tour="search" aria-label="Search" onclick={open}>
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10" cy="10" r="6.5" /><path d="M15 15l6 6" /></svg>
  </button>
{:else}
  <div class="search" role="search" data-tour="search" bind:this={box} onfocusin={() => (active = true)}>
    <input
      bind:this={input}
      type="search"
      aria-label="Search"
      placeholder="Search people, places, verses"
      autocomplete="off"
      bind:value={query}
      onkeydown={key}
      oninput={() => (active = true)}
    />
    {#if dropped}
      <div class="drop">
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
    {/if}
  </div>
{/if}

<style>
  /* On a desktop the box is a field at the start of the top bar (decision 210), as tall as the
     Your Path steps' row beside it; it is above the reader panel, so the drop below it is never
     hidden under it. */
  .search {
    position: fixed;
    z-index: 5;
    top: 10px;
    left: 16px;
    width: 300px;
  }
  /* The type chips and the results, in a card that drops below the field. */
  .drop {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    padding: 8px;
    background: rgba(20, 23, 34, 0.96);
    border: 1px solid #262a3c;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  /* On a phone the open box is a card over the top of the scene and the Your Path bar, the chips and
     the results inside it. */
  :global(html[data-phone]) .search {
    top: 8px;
    left: 8px;
    right: 8px;
    width: auto;
    padding: 8px;
    background: rgba(20, 23, 34, 0.92);
    border: 1px solid #262a3c;
    border-radius: 8px;
  }
  :global(html[data-phone]) .drop {
    position: static;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
  }
  /* At the side, the box and the icon are left of the sheet. */
  :global(html[data-side]) .search {
    right: calc(var(--sheet-covered) + var(--edge));
  }
  :global(html[data-side]) .open {
    right: var(--sheet-covered);
  }
  /* On a phone the type chips are one row that scrolls sideways, and every chip and result is
     large enough to tap. */
  :global(html[data-phone]) .chips {
    flex-wrap: nowrap;
    overflow-x: auto;
  }
  :global(html[data-phone]) .search button {
    flex: none;
    min-height: 44px;
  }
  /* The search icon: the end of the slim top bar, and as tall as it. */
  .open {
    position: fixed;
    top: 0;
    right: 0;
    width: var(--bar);
    height: var(--bar);
    padding: 0;
    display: grid;
    place-items: center;
    background: rgba(20, 23, 34, 0.92);
    border: 1px solid #262a3c;
    border-width: 0 0 1px 1px;
    border-radius: 0;
  }
  .open svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  input {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
    color: inherit;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid #3a4060;
    border-radius: 6px;
    padding: 0 10px;
    height: 36px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  :global(html[data-phone]) .chips {
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
