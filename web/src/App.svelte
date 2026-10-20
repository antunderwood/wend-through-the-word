<script lang="ts">
  import { onMount, tick } from "svelte";
  import { createData, type Data } from "./data";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import PathBar from "./PathBar.svelte";
  import { initialState, passes, reduce, relation, scene, typeOf, TYPES, TYPE_NAME, TYPE_PLURAL, type Action, type Id, type NodeType, type Scene, type View } from "./model";
  import Search from "./Search.svelte";
  import { store, stored } from "./storage";

  const START = "person:abraham_58";
  const HINT_KEY = "wend.hintDismissed";
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
  let data = $state.raw<Data>();
  let model = $state.raw(initialState(START));
  let sc = $state.raw<Scene>();
  let error = $state("");
  let hint = $state(!stored(HINT_KEY));
  let collapsed = $state(false);
  // The panel lists the Neighbours of `listed` and the Verses `versed` shares with the Focus. A
  // click in a list keeps that list, so the second click of a double click lands on the same item.
  let listed = $state(START);
  let versed = $state(START);
  let opened = $state<Record<string, boolean>>({}); // "owner|type" lists opened with "N more"
  const storedView = stored(VIEW_STORE);
  // The tilted plane unless the reader chose another view in this browser (decision 118).
  let view = $state<View>(storedView && Object.hasOwn(VIEWS, storedView) ? (storedView as View) : "A");

  function choose(v: View) {
    view = v;
    store(VIEW_STORE, v);
    graph?.setView(v); // the Focus Model state is untouched: only the view changes
  }

  // Left and Right on the picker step through the views, as a radio group does.
  async function stepView(e: KeyboardEvent) {
    const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    choose(VIEW_KEYS[(VIEW_KEYS.indexOf(view) + dir + VIEW_KEYS.length) % VIEW_KEYS.length]);
    await tick();
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[aria-checked="true"]')!.focus();
  }

  const overflowType = (id: Id) => id.slice("overflow:".length) as NodeType;
  const label = (id: Id) =>
    typeOf(id) === "overflow"
      ? `+${sc?.nodes.find((n) => n.id === id)?.count} ${TYPE_PLURAL[overflowType(id)]}`
      : data!.label(id);

  function apply(a: Action, from?: "neighbours" | "verses") {
    const next = reduce(model, a, label);
    if (next.focus !== model.focus || next.path !== model.path) sc = scene(next, data!.rec, data!.genderOf);
    if (next.selected !== model.selected || next.focus !== model.focus) {
      if (from !== "neighbours") listed = next.selected;
      if (from !== "verses") versed = next.selected;
    }
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

  // Separate from model so a list is loaded again only when its owner or the Focus changes.
  const focus = $derived(model.focus);
  // Both are read only once data is loaded. An Overflow Node lists all the Focus's Neighbours of its type.
  const listing = $derived(
    typeOf(listed) === "overflow"
      ? data!.loadWithKin(focus).then((r) => ({ r, types: [overflowType(listed)], whole: true }))
      : data!.loadWithKin(listed).then((r) => ({ r, types: TYPES, whole: false })),
  );
  const isEntity = (id: Id) => !["verse", "overflow"].includes(typeOf(id));
  const sharing = $derived(versed !== focus && isEntity(versed) && isEntity(focus) ? data!.shared(focus, versed) : Promise.resolve([]));

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
        graph.setView(view);
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
  <!-- The chevron points the way the panel will move. -->
  <button class="chevron" aria-controls="panel" aria-expanded={!collapsed} aria-label={collapsed ? "Show panel" : "Hide panel"} onclick={() => (collapsed = !collapsed)}>
    {collapsed ? "‹" : "›"}
  </button>
  <aside id="panel" class="panel" class:collapsed aria-label="Selected Node">
    <!-- Fixed height, so the Neighbour lists below never move between the two clicks of a double click. -->
    <section class="selected">
      <h2>{label(selected)}</h2>
      <p class="muted">{selectedType}</p>
      <p>{#if link}Relationship: <b>{relation(link, data.genderOf).text}</b>{/if}</p>
      <button onclick={() => makeFocus(selected)} disabled={selected === model.focus || typeOf(selected) === "overflow"}>Make Focus</button>
      <button onclick={() => apply({ type: "step", dir: -1 })}>Prev</button>
      <button onclick={() => apply({ type: "step", dir: 1 })}>Next</button>
      {#await sharing then verses}
        {#if verses.length}
          <h3 id="shared">Together in {verses.length} verse{verses.length === 1 ? "" : "s"}</h3>
          <ul aria-labelledby="shared">
            {#each verses as v (v.key)}
              <li>{@render item(v.key, "", "verses")}<p class="verse-text">{v.text}</p></li>
            {/each}
          </ul>
        {/if}
      {:catch e}
        <p class="muted">Could not load the shared verses: {e.message}</p>
      {/await}
    </section>
    {#await listing then list}
      {#each list.types as t (t)}
        {@const all = list.r.links.filter((l) => l.type === t && l.id !== list.r.id && passes(l, model.filters))}
        {@const key = `${listed}|${t}`}
        {@const k = model.filters.k}
        {#if all.length}
          <h3 id="list-{t}">{TYPE_NAME[t]} ({all.length})</h3>
          <ol aria-labelledby="list-{t}">
            {#each list.whole || opened[key] ? all : all.slice(0, k) as l (l.id)}
              <li>{@render item(l.id, relation(l, data.genderOf).text, "neighbours")}</li>
            {/each}
          </ol>
          {#if !list.whole && all.length > k}
            <button class="more" aria-expanded={!!opened[key]} onclick={() => (opened[key] = !opened[key])}>
              <span aria-hidden="true">{opened[key] ? "▾" : "▸"}</span>
              {opened[key] ? `Show top ${k}` : `${all.length - k} more`}
            </button>
          {/if}
        {/if}
      {/each}
    {:catch e}
      <p class="muted">Could not load the Neighbours: {e.message}</p>
    {/await}
  </aside>
  <PathBar {model} {label} {apply} />
{/if}

<!-- A click selects and a double click makes the Focus, as in the scene. -->
{#snippet item(id: Id, words: string, from: "neighbours" | "verses")}
  <button class="item" class:sel={id === selected} onclick={() => apply({ type: "select", id }, from)} ondblclick={() => makeFocus(id)}>
    {label(id)}
    {#if words}<span class="muted">{words}</span>{/if}
  </button>
{/snippet}
{#if hint}
  <p class="hint">
    A click selects a node. A double click, Make Focus, or search moves the Focus.
    <button aria-label="Dismiss hint" onclick={dismissHint}>&times;</button>
  </p>
{/if}
<div class="views" role="radiogroup" aria-label="View" tabindex="-1" onkeydown={stepView}>
  {#each VIEW_KEYS as key (key)}
    <button role="radio" aria-checked={view === key} tabindex={view === key ? 0 : -1} onclick={() => choose(key)}>{VIEW_NAME[key]}</button>
  {/each}
</div>
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
  /* The panel starts below the top strip, so it never covers the Your Path bar there. */
  .panel {
    position: fixed;
    top: 56px;
    right: 0;
    bottom: 0;
    width: 340px;
    box-sizing: border-box;
    padding: 12px 16px;
    overflow-y: auto;
    background: rgba(20, 23, 34, 0.92);
    border-left: 1px solid #262a3c;
    transition: transform 0.2s;
  }
  .panel.collapsed {
    transform: translateX(100%);
  }
  @media (prefers-reduced-motion: reduce) {
    .panel {
      transition: none;
    }
  }
  .chevron {
    position: fixed;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 999px;
    font-size: 20px;
    line-height: 1;
  }
  .selected {
    height: 300px;
    overflow-y: auto;
    border-bottom: 1px solid #262a3c;
  }
  .panel h2 {
    margin: 0;
    font-size: 17px;
  }
  .panel h3 {
    margin: 14px 0 4px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9aa0b4;
  }
  .panel p {
    margin: 4px 0;
    min-height: 1.45em;
  }
  .panel ol,
  .panel ul {
    margin: 0;
    padding-left: 22px;
  }
  .item {
    padding: 1px 4px;
    border: 0;
    background: none;
    text-align: left;
  }
  .item.sel {
    background: #262a3c;
  }
  .item .muted {
    font-size: 12px;
  }
  .panel .verse-text {
    margin: 0 0 8px 4px;
    opacity: 0.85;
  }
  .more {
    margin: 4px 0;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    color: #9aa0b4;
  }
  .more[aria-expanded="true"] {
    color: #ffd27a;
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
    top: 64px;
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
