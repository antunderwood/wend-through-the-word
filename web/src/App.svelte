<script lang="ts">
  import { onMount, tick } from "svelte";
  import { createData } from "./data";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import { initialState, scene, type View } from "./model";
  import { load, save } from "./storage";

  const START = "person:abraham_58";
  const getJSON = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  };

  const VIEW_NAME: Record<View, string> = { A: "Tilted plane", B: "Stacked discs", C: "Free orbit" };
  const VIEW_KEYS = Object.keys(VIEWS) as View[];
  const VIEW_STORE = "wend.view";

  let host: HTMLDivElement;
  let graph: Graph | undefined;
  let error = $state("");
  const stored = load(VIEW_STORE);
  // The tilted plane unless the reader chose another view in this browser (decision 118).
  let view = $state<View>(stored && Object.hasOwn(VIEWS, stored) ? (stored as View) : "A");

  function choose(v: View) {
    view = v;
    save(VIEW_STORE, v);
    graph?.setView(v); // the Focus Model state is untouched: only the view changes
  }

  // Left and Right on the picker step through the views, as a radio group does.
  async function step(e: KeyboardEvent) {
    const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    choose(VIEW_KEYS[(VIEW_KEYS.indexOf(view) + dir + VIEW_KEYS.length) % VIEW_KEYS.length]);
    await tick();
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-checked="true"]')!.focus();
  }

  onMount(() => {
    (async () => {
      try {
        const data = await createData(getJSON, "/data");
        await data.load(START);
        const model = initialState(START);
        graph = createGraph(host, data.label);
        graph.setView(view);
        graph.render(scene(model, data.rec, data.genderOf), model.selected);
        Object.assign(window, { wendGraph: graph }); // test-only hook for the browser tests
      } catch (e) {
        error = `Could not load the data: ${(e as Error).message}`;
      }
    })();
    return () => graph?.dispose();
  });
</script>

<div class="stage" bind:this={host}></div>
<div class="views" role="radiogroup" aria-label="View" tabindex="-1" onkeydown={step}>
  {#each VIEW_KEYS as key (key)}
    <button role="radio" aria-checked={view === key} tabindex={view === key ? 0 : -1} onclick={() => choose(key)}>{VIEW_NAME[key]}</button>
  {/each}
</div>
{#if error}<p class="notice">{error}</p>{/if}

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    background: #0d0f17;
    color: #e6e8f0;
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .stage {
    position: fixed;
    inset: 0;
  }
  .stage :global(canvas) {
    display: block;
    touch-action: none;
  }
  .views {
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: #161a28;
  }
  .views button {
    border: 0;
    border-radius: 999px;
    padding: 4px 12px;
    background: none;
    color: #9aa0b4;
    font: inherit;
    cursor: pointer;
  }
  .views button[aria-checked="true"] {
    background: #2a3048;
    color: #ffd27a;
  }
  .notice {
    position: fixed;
    left: 16px;
    bottom: 16px;
    margin: 0;
  }
</style>
