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
  <ol>
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
  .path {
    position: fixed;
    top: 16px;
    left: 350px; /* beside the search box (16 + 318 + 16) */
    right: 56px; /* clear of the panel chevron; the panel starts below the bar */
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: rgba(20, 23, 34, 0.92);
    border: 1px solid #262a3c;
    border-radius: 8px;
  }
  ol {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-x: auto;
    white-space: nowrap;
  }
  button {
    font: inherit;
    font-size: 12px;
    color: inherit;
    background: none;
    border: 1px solid #3a4060;
    border-radius: 999px;
    padding: 2px 8px;
    cursor: pointer;
    touch-action: manipulation; /* a double tap on a step makes the Focus, never zooms; a drag still scrolls */
    /* A double click makes the Focus and never selects the step's text, which Safari would do. */
    -webkit-user-select: none; /* Safari's name for it */
    user-select: none;
  }
  .focus {
    border-color: #ffd27a;
    color: #ffd27a;
  }
  .selected {
    background: rgba(255, 255, 255, 0.12);
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
    background: #262a3c;
  }
  /* On a phone the bar is the slim top bar, one row with the search icon at its end (decision 183):
     the steps scroll sideways and Clear or Undo clear stays at the end, and the steps are as tall as
     the bar lets them be. */
  :global(html[data-phone]) .path {
    top: 0;
    left: 0;
    right: var(--bar); /* the search icon */
    height: var(--bar);
    box-sizing: border-box;
    padding: 0 4px;
    border-width: 0 0 1px;
    border-radius: 0;
  }
  /* At the side, left of the sheet and the search icon. */
  :global(html[data-side]) .path {
    right: calc(var(--sheet-covered) + var(--bar));
  }
  :global(html[data-phone]) ol {
    min-width: 0;
  }
  :global(html[data-phone]) button {
    min-height: 34px;
  }
</style>
