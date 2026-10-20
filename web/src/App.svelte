<script lang="ts">
  import { onMount } from "svelte";
  import { createData, type Data } from "./data";
  import { createGraph, type Graph } from "./graph";
  import { initialState, reduce, relation, scene, typeOf, TYPE_NAME, TYPE_PLURAL, type Action, type Id, type NodeType, type Scene } from "./model";
  import Search from "./Search.svelte";
  import { store, stored } from "./storage";

  const START = "person:abraham_58";
  const HINT_KEY = "wend.hintDismissed";
  const getJSON = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  };

  let host: HTMLDivElement;
  let graph: Graph | undefined;
  let data = $state.raw<Data>();
  let model = $state.raw(initialState(START));
  let sc = $state.raw<Scene>();
  let error = $state("");
  let hint = $state(!stored(HINT_KEY));

  const overflowType = (id: Id) => id.slice("overflow:".length) as NodeType;
  const label = (id: Id) =>
    typeOf(id) === "overflow"
      ? `+${sc?.nodes.find((n) => n.id === id)?.count} ${TYPE_PLURAL[overflowType(id)]}`
      : data!.label(id);

  function apply(a: Action) {
    const next = reduce(model, a, label);
    if (next.focus !== model.focus) sc = scene(next, data!.rec, data!.genderOf);
    model = next;
    graph?.render(sc!, model.selected);
  }

  // The new Focus and its relatives load first; a later move wins over an earlier one still loading.
  let moves = 0;
  async function makeFocus(id: Id) {
    if (typeOf(id) === "overflow") {
      model = { ...model, notice: "An Overflow Node cannot be the Focus." };
      return;
    }
    const mine = ++moves;
    try {
      await data!.loadWithKin(id);
    } catch (e) {
      model = { ...model, notice: `Could not load ${label(id)}: ${(e as Error).message}` };
      return;
    }
    if (mine === moves) apply({ type: "focus", id });
  }

  const selected = $derived(model.selected);
  const selectedType = $derived(typeOf(selected) === "overflow" ? "Overflow Node" : TYPE_NAME[typeOf(selected) as NodeType]);
  // The Relationship is read from the Focus: Isaac is Abraham's son.
  const link = $derived(selected === model.focus ? undefined : data?.rec(model.focus)?.links.find((l) => l.id === selected));

  function dismissHint() {
    hint = false;
    store(HINT_KEY, "1");
  }

  onMount(() => {
    (async () => {
      try {
        data = await createData(getJSON, "/data");
        await data.loadWithKin(START);
        sc = scene(model, data.rec, data.genderOf);
        graph = createGraph(host, data.label, data.quote);
        graph.onNodeClick((id) => apply({ type: "select", id }));
        graph.onNodeDoubleClick(makeFocus);
        graph.render(sc, model.selected);
        Object.assign(window, { wendGraph: graph }); // test-only hook for the browser tests
      } catch (e) {
        error = `Could not load the data: ${(e as Error).message}`;
      }
    })();
    return () => graph?.dispose();
  });
</script>

<div class="stage" bind:this={host}></div>
{#if sc && data}
  <Search {data} onchoose={makeFocus} />
  <aside class="panel" aria-label="Selected Node">
    <h2>{label(selected)}</h2>
    <p class="muted">{selectedType}</p>
    {#if link}<p>Relationship: <b>{relation(link, data.genderOf).text}</b></p>{/if}
    <button onclick={() => makeFocus(selected)} disabled={selected === model.focus || typeOf(selected) === "overflow"}>Make Focus</button>
  </aside>
{/if}
{#if hint}
  <p class="hint">
    A click selects a node. A double click, Make Focus, or search moves the Focus.
    <button aria-label="Dismiss hint" onclick={dismissHint}>&times;</button>
  </p>
{/if}
<p class="notice" role="status">{error || model.notice}</p>

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
  .panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 280px;
    padding: 12px 16px;
    background: rgba(20, 23, 34, 0.92);
    border: 1px solid #262a3c;
    border-radius: 8px;
  }
  .panel h2 {
    margin: 0;
    font-size: 17px;
  }
  .panel p {
    margin: 4px 0;
  }
  .muted {
    color: #9aa0b4;
  }
  button {
    font: inherit;
    color: inherit;
    background: #262a3c;
    border: 1px solid #3a4060;
    border-radius: 4px;
    padding: 3px 10px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .hint {
    position: fixed;
    left: 50%;
    top: 16px;
    transform: translateX(-50%);
    margin: 0;
    padding: 6px 8px 6px 14px;
    background: rgba(20, 23, 34, 0.92);
    border-radius: 6px;
    color: #c8cde0;
  }
  .hint button {
    margin-left: 8px;
    padding: 0 7px;
  }
  .notice {
    position: fixed;
    left: 16px;
    bottom: 16px;
    margin: 0;
    color: #9aa0b4;
  }
</style>
