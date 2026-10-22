<script lang="ts">
  // The reader panel: the BSB text of one chapter (decision 127). It does not assume where it is
  // mounted: a left drawer on desktop, a tab of the bottom sheet on a phone (decision 115).
  import { tick } from "svelte";
  import type { Data } from "./data";
  import type { Id } from "./model";
  import { screen } from "./screen.svelte";

  let {
    data,
    at,
    selected,
    inScene,
    onselect,
    onfocus,
    onmove,
    onclose,
  }: {
    data: Data;
    at: Id; // a Verse: its chapter is shown, scrolled to it
    selected: Id;
    inScene: (id: Id) => boolean;
    onselect: (id: Id) => void;
    onfocus: (id: Id) => void;
    onmove: (id: Id) => void; // the previous or next chapter's first Verse
    onclose?: () => void; // a close button, where the panel can close
  } = $props();

  const outside = $derived(data.outside(at));
  // Loaded again only when the chapter changes, so a click in it never redraws the text.
  const key = $derived(at.slice(0, 5));
  const chapter = $derived(outside ? undefined : data.chapter(`${key}001`));
  const previous = $derived(outside ? undefined : data.nextChapter(at, -1));
  const next = $derived(outside ? undefined : data.nextChapter(at, 1));

  let text = $state<HTMLElement>();
  let shown = ""; // the chapter last scrolled in
  // Scrolls to the Selected Verse, or to `at` when the Selected Node is not in this chapter: to the
  // middle in a new chapter, and only as far as needed in the same one, so a click never moves the
  // text under the second click of a double click.
  $effect(() => {
    const target = selected.startsWith(key) ? selected : at;
    chapter?.then(tick).then(() => {
      text?.querySelector(`[data-key="${target}"]`)?.scrollIntoView({ block: shown === key ? "nearest" : "center" });
      shown = key;
    });
  });
</script>

{#snippet head(title: string)}
  <header>
    <button aria-label="Previous chapter" disabled={!previous} onclick={() => onmove(previous!)}>‹</button>
    <h2>{title}</h2>
    <button aria-label="Next chapter" disabled={!next} onclick={() => onmove(next!)}>›</button>
    {#if onclose}<button class="close" aria-label="Close reader" onclick={onclose}>&times;</button>{/if}
  </header>
{/snippet}

<section class="reader" aria-label="Reader">
  {#if outside}
    {@render head(data.label(at))}
    <p class="muted">{outside}</p>
  {:else}
    {#await chapter then c}
      {@render head(c!.title)}
      <div class="text" bind:this={text}>
        <!-- A click selects and a double click makes the Focus, as in the scene and the lists. The
             verse number is the target; on a phone the whole verse is, its words too. -->
        {#each c!.verses as v (v.key)}
          {@const n = +v.key.slice(5)}
          {@const target = {
            "aria-label": data.label(v.key),
            "aria-current": v.key === selected,
            title: inScene(v.key) ? "In the scene" : undefined,
            onclick: () => onselect(v.key),
            ondblclick: () => onfocus(v.key),
          }}
          {#if screen.phone}
            <button class="verse whole" class:sel={v.key === selected} class:linked={inScene(v.key)} data-key={v.key} {...target}>
              <span class="number">{n}</span>
              {v.text}
            </button>
          {:else}
            <span class="verse" class:sel={v.key === selected} data-key={v.key}>
              <button class:linked={inScene(v.key)} {...target}>{n}</button>
              {v.text}
            </span>
          {/if}
        {/each}
      </div>
    {:catch e}
      <p class="muted">Could not load the chapter: {e.message}</p>
    {/await}
  {/if}
  <p class="muted translation">Berean Standard Bible</p>
</section>

<style>
  .reader {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h2 {
    flex: 1;
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.3;
    text-align: center;
  }
  header button {
    width: 30px;
    height: 30px;
    padding: 0;
    font-size: 20px;
    line-height: 1;
  }
  header .close {
    margin-left: 8px;
    border-radius: 999px;
  }
  .text {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    margin-top: 10px;
    padding-right: 6px;
    font-size: 18px;
    line-height: 1.75;
    color: #e6e8f0;
  }
  .verse {
    border-radius: 3px;
  }
  .verse.sel {
    background: rgba(255, 210, 122, 0.16);
  }
  .verse button {
    padding: 0 2px;
    border: 0;
    background: none;
    color: #9aa0b4;
    font: 600 12px/1 system-ui, sans-serif;
    vertical-align: super;
  }
  /* A verse number keeps its line's height wherever the reader is mounted, even in a place that
     makes its buttons taller to tap. */
  .reader .verse button {
    min-height: 0;
  }
  /* In the scene: a brighter number, underlined with dots. */
  .verse button.linked {
    color: #d4d8e8;
    text-decoration: underline dotted;
  }
  .verse button[aria-current="true"] {
    color: #ffd27a;
  }
  /* On a phone a verse is a button the width of the text: its number, then its words. */
  .verse.whole {
    display: block;
    width: 100%;
    margin: 0 0 4px;
    padding: 4px 6px;
    border: 0;
    background: none;
    font: inherit;
    text-align: left;
  }
  .verse.whole .number {
    color: #9aa0b4;
    font: 600 12px/1 system-ui, sans-serif;
    vertical-align: super;
  }
  .verse.whole.linked .number {
    color: #d4d8e8;
    text-decoration: underline dotted;
  }
  .verse.whole[aria-current="true"] .number {
    color: #ffd27a;
  }
  .muted {
    color: #9aa0b4;
  }
  .translation {
    margin: 8px 0 0;
    font-size: 12px;
  }
  button {
    font: inherit;
    color: inherit;
    background: #262a3c;
    border: 1px solid #3a4060;
    border-radius: 4px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
