<script lang="ts">
  import type { Action, Id, State } from "./model";

  let { model, label, apply }: { model: State; label: (id: Id) => string; apply: (a: Action) => void } = $props();
  // The Focus first, then Your Path newest first.
  const items = $derived([model.focus, ...[...model.path].reverse()]);
</script>

<nav class="path" aria-label="Your Path">
  <ol>
    {#each items as id, i (id)}
      <li>
        <button class:focus={i === 0} class:selected={id === model.selected} onclick={() => apply({ type: "select", id })}>{label(id)}</button>
      </li>
    {/each}
  </ol>
  {#if model.cleared}
    <button class="clear" onclick={() => apply({ type: "undoClear" })}>Undo clear</button>
  {:else if model.path.length}
    <button class="clear" onclick={() => apply({ type: "clearPath" })}>Clear</button>
  {/if}
</nav>

<style>
  .path {
    position: fixed;
    top: 16px;
    left: 350px; /* beside the search box (16 + 318 + 16) */
    right: 346px; /* clear of the panel */
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
  }
  .focus {
    border-color: #ffd27a;
    color: #ffd27a;
  }
  .selected {
    background: rgba(255, 255, 255, 0.12);
  }
  .clear {
    flex: none;
    margin-left: auto;
    border-radius: 4px;
    background: #262a3c;
  }
</style>
