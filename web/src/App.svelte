<script lang="ts">
  import { onMount, tick } from "svelte";
  import { createData, fetchJSON, type Data } from "./data";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import PathBar from "./PathBar.svelte";
  import { afterClear, hiddenNote, initialState, passes, reduce, relation, scene, typeOf, TYPES, TYPE_NAME, TYPE_PLURAL, type Action, type Id, type NodeType, type Scene, type SceneNode, type View } from "./model";
  import Search from "./Search.svelte";
  import { store, stored } from "./storage";

  const START = "person:abraham_58";
  const HINT_KEY = "wend.hintDismissed";

  const VIEW_NAME: Record<View, string> = { A: "Tilted plane", B: "Stacked discs", C: "Free orbit" };
  const VIEW_KEYS = Object.keys(VIEWS) as View[];
  const VIEW_STORE = "wend.view";

  let host: HTMLDivElement;
  let graph: Graph | undefined;
  let data = $state.raw<Data>();
  let model = $state.raw(initialState(START));
  let sc = $state.raw<Scene>();
  // A data file failed twice (the loader retries once): a message and a Retry, never a broken scene.
  let failure = $state<{ message: string; retry: () => void }>();
  let noWebGL = $state(false);
  let hint = $state(!stored(HINT_KEY));
  let tip = $state.raw<{ text: string; x: number; y: number } | null>(null);
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
    let next = reduce(model, a, label);
    if (next.focus !== model.focus || next.path !== model.path || next.filters !== model.filters || next.pins !== model.pins) sc = scene(next, data!.rec, data!.genderOf);
    if (a.type === "clearPath") next = afterClear(next, sc!);
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
    const refused = typeOf(id) === "overflow" ? "An Overflow Node cannot be the Focus." : data!.outside(id);
    if (refused) {
      model = { ...model, notice: refused };
      return;
    }
    const mine = ++moves;
    failure = undefined;
    try {
      await data!.loadWithKin(id);
    } catch (e) {
      if (mine === moves) failure = { message: `Could not load ${label(id)}: ${(e as Error).message}`, retry: () => makeFocus(id) };
      return;
    }
    if (mine === moves) apply({ type: "focus", id });
  }

  // A pin's record must be loaded before the scene can draw its ring.
  async function pin(id: Id) {
    if (data!.outside(id)) {
      model = { ...model, notice: data!.outside(id) };
      return;
    }
    if (typeOf(id) !== "overflow") {
      failure = undefined;
      try {
        await data!.load(id);
      } catch (e) {
        failure = { message: `Could not load ${label(id)}: ${(e as Error).message}`, retry: () => pin(id) };
        return;
      }
    }
    apply({ type: "pin", id });
  }

  const selected = $derived(model.selected);
  const selectedType = $derived(typeOf(selected) === "overflow" ? "Overflow Node" : TYPE_NAME[typeOf(selected) as NodeType]);
  // The Relationship is read from the Focus: Isaac is Abraham's son.
  const link = $derived(selected === model.focus ? undefined : data?.rec(model.focus)?.links.find((l) => l.id === selected));

  // An unlabelled node names itself on hover; Ring 2 also shows its way to the Focus.
  function showTip(n: SceneNode | null, x: number, y: number) {
    const named = n && ["ring2", "pinring", "path"].includes(n.role);
    const text = n?.role === "ring2" ? [n.id, n.via!, model.focus].map(label).join(" → ") : named ? label(n.id) : "";
    tip = text ? { text, x, y } : null;
  }

  // Separate from model so a list is loaded again only when its owner or the Focus changes.
  const focus = $derived(model.focus);
  // A Retry in the panel loads both lists again.
  let retries = $state(0);
  // Both are read only once data is loaded. An Overflow Node lists all the Focus's Neighbours of its type.
  const listing = $derived.by(() => {
    retries;
    return typeOf(listed) === "overflow"
      ? data!.loadWithKin(focus).then((r) => ({ r, types: [overflowType(listed)], whole: true }))
      : data!.loadWithKin(listed).then((r) => ({ r, types: TYPES, whole: false }));
  });
  const isEntity = (id: Id) => !["verse", "overflow"].includes(typeOf(id));
  // The Verses `versed` shares with the Focus, then with each pin.
  const pins = $derived(model.pins);
  const sharing = $derived.by(() => {
    retries;
    return Promise.all(
      [...new Set([focus, ...pins])]
        .filter((o) => o !== versed && isEntity(versed) && isEntity(o))
        .map(async (o) => ({ with: o, verses: await data!.shared(o, versed) })),
    );
  });

  // Keys on the scene (or on nothing): the arrows step the selection through Ring 1 in sector order,
  // Right and Down forward, Enter makes the Selected Node the Focus, Backspace goes back to the newest
  // node on Your Path (PRD 10.4). Keys in the search box, a button, or the view picker are theirs.
  function sceneKey(e: KeyboardEvent) {
    if ((e.target !== document.body && e.target !== host) || e.altKey || e.ctrlKey || e.metaKey || !sc) return;
    const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (dir) {
      const ring = sc.nodes.filter((n) => n.ring1).sort((a, b) => a.ring1!.ti - b.ring1!.ti || a.ring1!.pos - b.ring1!.pos);
      const i = ring.findIndex((n) => n.id === model.selected);
      apply({ type: "select", id: ring[i < 0 ? (dir > 0 ? 0 : ring.length - 1) : (i + dir + ring.length) % ring.length].id });
    } else if (e.key === "Enter") {
      if (model.selected !== model.focus) makeFocus(model.selected);
    } else if (e.key === "Backspace") {
      if (model.path.length) makeFocus(model.path[model.path.length - 1]);
      else model = { ...model, notice: "Your Path is empty." };
    } else return;
    e.preventDefault();
  }

  function dismissHint() {
    hint = false;
    store(HINT_KEY, "1");
  }

  async function start() {
    failure = undefined;
    try {
      data = await createData(fetchJSON, "/data");
      await data.loadWithKin(START);
    } catch (e) {
      failure = { message: `Could not load the data: ${(e as Error).message}`, retry: start };
      return;
    }
    sc = scene(model, data.rec, data.genderOf);
    try {
      graph = createGraph(host, data.label, data.quote);
    } catch {
      noWebGL = true; // the panel works alone (PRD 10.2 items 8 and 9)
      return;
    }
    graph.setView(view);
    graph.onNodeClick((id) => apply({ type: "select", id }));
    graph.onNodeDoubleClick(makeFocus);
    graph.onHover(showTip);
    graph.render(sc, model.selected);
    // The browser tests read node positions; only their build (vite build --mode e2e) has the hook.
    if (import.meta.env.MODE === "e2e") Object.assign(window, { wendGraph: graph });
  }

  onMount(() => {
    start();
    return () => graph?.dispose();
  });
</script>

<svelte:window onkeydown={sceneKey} />
<!-- The scene takes keyboard focus so its keys work after a click on it (ARIA "application"). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="stage" role="application" aria-label="Graph: arrow keys select a Ring 1 node, Enter makes it the Focus, Backspace goes back" tabindex="0" bind:this={host}></div>
{#if sc && data}
  <Search {data} onchoose={makeFocus} />
  <!-- The chevron points the way the panel will move. -->
  <button class="chevron" hidden={noWebGL} aria-controls="panel" aria-expanded={!collapsed} aria-label={collapsed ? "Show panel" : "Hide panel"} onclick={() => (collapsed = !collapsed)}>
    {collapsed ? "‹" : "›"}
  </button>
  <aside id="panel" class="panel" class:collapsed class:full={noWebGL} aria-label="Selected Node">
    {#if noWebGL}
      <p class="fallback">This browser has no WebGL, so the graph is not drawn. The lists below work alone: a click selects, a double click makes the Focus.</p>
    {/if}
    <!-- Fixed height, so the Neighbour lists below never move between the two clicks of a double click. -->
    <section class="selected">
      <h2>{label(selected)}</h2>
      <p class="muted">{selectedType}</p>
      <p>{#if link}Relationship: <b>{relation(link, data.genderOf).text}</b>{/if}</p>
      {#if data.outside(selected)}<p class="muted">{data.outside(selected)}</p>{/if}
      <button onclick={() => makeFocus(selected)} disabled={selected === model.focus || typeOf(selected) === "overflow"}>Make Focus</button>
      {#if model.pins.includes(selected)}
        <button onclick={() => apply({ type: "unpin", id: selected })}>Unpin</button>
      {:else}
        <button onclick={() => pin(selected)}>Pin</button>
      {/if}
      <button onclick={() => apply({ type: "step", dir: -1 })}>Prev</button>
      <button onclick={() => apply({ type: "step", dir: 1 })}>Next</button>
      {#await sharing then lists}
        {#each lists as { with: o, verses }, i (o)}
          {#if verses.length}
            <h3 id="shared-{i}">Together {o === focus ? "" : `with ${label(o)} `}in {verses.length} verse{verses.length === 1 ? "" : "s"}</h3>
            <ul aria-labelledby="shared-{i}">
              {#each verses as v (v.key)}
                <li>{@render item(v.key, "", "verses")}<p class="verse-text">{v.text}</p></li>
              {/each}
            </ul>
          {/if}
        {/each}
      {:catch e}
        {@render failed("the shared verses", e)}
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
      <!-- A Verse outside the build has no lists; the note above says why. -->
      {#if !data.outside(listed)}{@render failed("the Neighbours", e)}{/if}
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
{#snippet failed(what: string, e: Error)}
  <p class="muted">Could not load {what}: {e.message} <button onclick={() => retries++}>Retry</button></p>
{/snippet}
{#if hint}
  <p class="hint">
    A click selects a node. A double click, Make Focus, or search moves the Focus.
    <button aria-label="Dismiss hint" onclick={dismissHint}>&times;</button>
  </p>
{/if}
{#if failure}
  <div class="failure" role="alert">
    <p>{failure.message}</p>
    <button onclick={failure.retry}>Retry</button>
  </div>
{/if}
{#if !noWebGL}
  <div class="views" role="radiogroup" aria-label="View" tabindex="-1" onkeydown={stepView}>
    {#each VIEW_KEYS as key (key)}
      <button role="radio" aria-checked={view === key} tabindex={view === key ? 0 : -1} onclick={() => choose(key)}>{VIEW_NAME[key]}</button>
    {/each}
  </div>
{/if}
<p class="notice" role="status">{model.notice}</p>
{#if sc?.hidden}<p class="trimmed">{hiddenNote(sc)}</p>{/if}
{#if tip}<div class="tip" role="tooltip" style:left="{tip.x + 14}px" style:top="{tip.y + 14}px">{tip.text}</div>{/if}

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
  .panel.full {
    left: 0;
    width: auto;
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
  .trimmed {
    position: fixed;
    left: 16px;
    bottom: 40px; /* above the notice line */
    margin: 0;
    font-size: 12px;
    color: #9aa0b4;
  }
  .tip {
    position: fixed;
    pointer-events: none;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid #262a3c;
    border-radius: 6px;
    font-size: 12px;
  }
  .fallback {
    color: #ffd27a;
  }
  .failure {
    position: fixed;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    padding: 12px 16px;
    background: rgba(20, 23, 34, 0.96);
    border: 1px solid #3a4060;
    border-radius: 8px;
    text-align: center;
  }
  .failure p {
    margin: 0 0 8px;
  }
  .notice {
    position: fixed;
    left: 16px;
    bottom: 16px;
    margin: 0;
    color: #9aa0b4;
  }
</style>
