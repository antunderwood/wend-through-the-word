<script lang="ts">
  import { doubleClickTimer } from "./graph";
  import type { Action, Id, State } from "./model";

  let {
    model,
    label,
    apply,
    notes,
    makeFocus,
  }: { model: State; label: (id: Id) => string; apply: (a: Action) => void; notes: Record<Id, string>; makeFocus: (id: Id) => void } = $props();
  // The Focus first, then Your Path newest first.
  const items = $derived([model.focus, ...[...model.path].reverse()]);
  // Whatever selects a step (a click, Prev and Next, a node in the scene) brings its pill into view: the
  // row scrolls sideways, by the least it takes, and not at all when the pill is already whole.
  let row = $state<HTMLOListElement>();
  $effect(() => {
    void model.selected;
    void items.length;
    const pill = row?.querySelector<HTMLElement>("button.selected");
    if (!row || !pill) return;
    const r = row.getBoundingClientRect();
    const b = pill.getBoundingClientRect();
    const by = b.left < r.left ? b.left - r.left - 8 : b.right > r.right ? b.right - r.right + 8 : 0;
    if (by) row.scrollBy({ left: by, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  // A click selects at once, and a second click on the same step within the double click time makes
  // it the Focus (decision 206); the Focus's own step stays as it is. A click from the keyboard
  // (detail 0) only selects, as before.
  const isDouble = doubleClickTimer();
  function clicked(id: Id, e: MouseEvent) {
    if (e.detail && isDouble(id)) {
      if (id !== model.focus) makeFocus(id);
    } else apply({ type: "select", id });
  }
</script>

<nav class="path" aria-label="Your Path">
  <ol bind:this={row}>
    {#each items as id, i (id)}
      <li>
        <button data-tour="path-{id}" class:focus={i === 0} class:selected={id === model.selected} class:noted={notes[id]} title={notes[id] ? "Has a note" : undefined} onclick={(e) => clicked(id, e)}>{label(id)}</button>
      </li>
    {/each}
  </ol>
  {#if model.cleared}
    <button class="clear" data-tour="clear" onclick={() => apply({ type: "undoClear" })}>Undo clear</button>
  {:else if model.path.length}
    <button class="clear" data-tour="clear" onclick={() => apply({ type: "clearPath" })}>Clear</button>
  {/if}
</nav>

<style>
  /* On a desktop window the page's top row places it, beside the search field: the steps lie on the
     top bar with no box of their own (decision 212). */
  .path {
    /* Only as wide as its steps need (decision 209); the top row lets it grow up to the panel's
       chevron, and past that the steps scroll sideways. */
    flex: 0 1 auto;
    min-width: 0;
    height: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  ol {
    display: flex;
    min-width: 0;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-x: auto;
    white-space: nowrap;
  }
  button {
    font: inherit;
    font-size: var(--fs-sm);
    color: inherit;
    background: none;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 2px 8px;
    cursor: pointer;
    touch-action: manipulation; /* a double tap on a step makes the Focus, never zooms; a drag still scrolls */
    /* A double click makes the Focus and never selects the step's text, which Safari would do. */
    -webkit-user-select: none; /* Safari's name for it */
    user-select: none;
  }
  .focus {
    border-color: var(--accent);
    color: var(--accent);
  }
  .selected {
    background: var(--pressed);
  }
  /* A step with a note; the title says so to a screen reader. */
  .noted::after {
    content: "✎" / "";
    margin-left: 4px;
    opacity: 0.7;
  }
  .clear {
    flex: none;
    margin-left: auto;
    border-radius: 4px;
    background: var(--control);
  }
  /* On a phone the bar is the slim top bar, one row with the search icon at its end (decision 183):
     the steps scroll sideways and Clear or Undo clear stays at the end, and the steps are as tall as
     the bar lets them be. */
  :global(html[data-phone]) .path {
    position: fixed;
    top: 0;
    left: 0;
    right: var(--bar); /* the search icon */
    height: var(--bar);
    box-sizing: border-box;
    padding: 0 4px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  /* At the side, left of the sheet and the search icon. */
  :global(html[data-side]) .path {
    right: calc(var(--sheet-covered) + var(--bar));
  }
  :global(html[data-phone]) button {
    min-height: 34px;
  }
</style>
