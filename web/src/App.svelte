<script lang="ts">
  import { onMount } from "svelte";
  import { createData } from "./data";
  import { createGraph } from "./graph";
  import { initialState, scene } from "./model";

  const START = "person:abraham_58";
  const getJSON = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  };

  let host: HTMLDivElement;
  let error = $state("");

  onMount(() => {
    let graph: ReturnType<typeof createGraph> | undefined;
    (async () => {
      try {
        const data = await createData(getJSON, "/data");
        await data.load(START);
        const model = initialState(START);
        graph = createGraph(host, data.label);
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
  .notice {
    position: fixed;
    left: 16px;
    bottom: 16px;
    margin: 0;
  }
</style>
