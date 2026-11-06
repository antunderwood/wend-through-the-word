<script module lang="ts">
  export const LEGEND_ID = "legend";
</script>

<script lang="ts">
  // The key to the scene: what each disc's colour and letter mean, and what the rings and lines
  // show. A popover from the Key button below the scene, like the filters; on a phone a section of
  // the Details tab, after them.
  import { TYPE_LETTER, typeColour } from "./colours";
  import { TYPES, TYPE_NAME } from "./model";

  let { inline = false }: { inline?: boolean } = $props();
</script>

<div id={LEGEND_ID} class="legend" class:inline popover={inline ? undefined : ""} role={inline ? "group" : "dialog"} aria-label="Key">
  {#if inline}<h3>Key</h3>{/if}
  <ul aria-label="Node types">
    {#each TYPES as t (t)}
      <li><span class="disc" style:background={typeColour(t)} aria-hidden="true">{TYPE_LETTER[t]}</span>{TYPE_NAME[t]}</li>
    {/each}
  </ul>
  <ul aria-label="Scene">
    <li><span class="disc focus" aria-hidden="true"></span>The Focus</li>
    <li><span class="dot" aria-hidden="true"></span>One step further out</li>
    <li><span class="line" aria-hidden="true"></span>Direct link</li>
    <li><span class="line dashed" aria-hidden="true"></span>Only named in the same verses</li>
    <li><span class="disc shared" aria-hidden="true"></span>Shared with a pinned node</li>
  </ul>
</div>

<style>
  /* Above the controls, like the filter panel. */
  .legend {
    inset: auto auto 60px 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 10px 14px;
    font-size: 12px;
    color: #c8cde0;
    background: rgba(20, 23, 34, 0.96);
    border: 1px solid #3a4060;
    border-radius: 8px;
  }
  .legend.inline {
    padding: 0;
    transform: none;
    background: none;
    border: 0;
    border-radius: 0;
  }
  h3 {
    margin: 14px 0 6px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9aa0b4;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    align-content: start;
    gap: 4px;
  }
  ul + ul {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #262a3c;
  }
  /* The sheet makes every row 44 px tall (a tap target), so on a phone the rows go in two columns. */
  .legend.inline ul {
    grid-template-columns: 1fr 1fr;
    gap: 0 12px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .disc {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 900;
    color: rgba(0, 0, 0, 0.78);
  }
  .disc.focus {
    background: #ffd27a;
    box-shadow: 0 0 0 2px #0d0f17, 0 0 0 3px #ffd27a;
  }
  .disc.shared {
    background: #a9b1c6;
    box-shadow: 0 0 0 2px #4ff0e0;
  }
  .dot {
    width: 16px;
    display: inline-grid;
    place-items: center;
  }
  .dot::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #8a90a8;
  }
  .line {
    width: 16px;
    border-top: 1px solid #c8cde0;
  }
  .line.dashed {
    border-top-style: dashed;
  }
</style>
