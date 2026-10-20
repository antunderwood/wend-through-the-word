<script lang="ts">
  import { onMount, tick } from "svelte";
  import { createData, type Data } from "./data";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import PathBar from "./PathBar.svelte";
  import { initialState, reduce, relation, scene, typeOf, TYPE_NAME, TYPE_PLURAL, type Action, type Id, type NodeType, type Scene, type SceneNode, type View } from "./model";
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
  let tip = $state.raw<{ text: string; x: number; y: number } | null>(null);
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

  function apply(a: Action) {
    const next = reduce(model, a, label);
    if (next.focus !== model.focus || next.path !== model.path || next.filters !== model.filters) sc = scene(next, data!.rec, data!.genderOf);
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

  // An unlabelled node names itself on hover; Ring 2 also shows its way to the Focus.
  function showTip(n: SceneNode | null, x: number, y: number) {
    const named = n && ["ring2", "pinring", "path"].includes(n.role);
    const text = n?.role === "ring2" ? [n.id, n.via!, model.focus].map(label).join(" → ") : named ? label(n.id) : "";
    tip = text ? { text, x, y } : null;
  }

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
        graph.onHover(showTip);
        graph.render(sc, model.selected);
        // Test only until search (#22): wendFocus makes any Entity or Verse the Focus. wendApply
        // dispatches any action, such as a node limit, which has no entry yet (#30).
        Object.assign(window, { wendGraph: graph, wendFocus: makeFocus, wendApply: apply }); // test-only hooks for the browser tests
      } catch (e) {
        error = `Could not load the data: ${(e as Error).message}`;
      }
    })();
    return () => graph?.dispose();
  });
</script>

<div class="stage" bind:this={host}></div>
{#if sc && data}
  <aside class="panel" aria-label="Selected Node">
    <h2>{label(selected)}</h2>
    <p class="muted">{selectedType}</p>
    {#if link}<p>Relationship: <b>{relation(link, data.genderOf).text}</b></p>{/if}
    <button onclick={() => makeFocus(selected)} disabled={selected === model.focus || typeOf(selected) === "overflow"}>Make Focus</button>
    <button onclick={() => apply({ type: "step", dir: -1 })}>Prev</button>
    <button onclick={() => apply({ type: "step", dir: 1 })}>Next</button>
  </aside>
  <PathBar {model} {label} {apply} />
{/if}
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
{#if sc?.hidden}<p class="trimmed">{sc.hidden} faint node{sc.hidden === 1 ? "" : "s"} hidden to keep the view fast</p>{/if}
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
    right: 16px;
    bottom: 16px;
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
  .notice {
    position: fixed;
    left: 16px;
    bottom: 16px;
    margin: 0;
    color: #9aa0b4;
  }
</style>
