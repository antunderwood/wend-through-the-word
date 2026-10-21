<script lang="ts">
  // The node limit test page (spec, module 6): the frame rate of each view at rising node counts
  // and on the Genesis hubs, for the owner to set the desktop node limit (PRD 11).
  import { onMount } from "svelte";
  import { createData, fetchJSON, type Data } from "./data";
  import { createGraph, VIEWS, type Graph } from "./graph";
  import { initialState, reduce, scene, type Id, type Scene, type View } from "./model";
  import { COUNTS, synthetic } from "./synthetic";

  // The hubs as the Focus under the real rules (spec, user story 58).
  const HUBS: Record<string, Id> = { God: "person:god_1324", Jacob: "person:israel_682", Egypt: "place:egypt_362", Canaan: "place:canaan_272" };
  const CHOICES = [...COUNTS.map((n) => `${n} nodes`), ...Object.keys(HUBS)];
  const READINGS = 5; // the rate shown is the mean of the last 5 one-second readings
  const WIDTHS = [6, 12, 7, 8, 8, 10, 9, 10]; // columns of a result line

  let host: HTMLDivElement;
  let graph: Graph | undefined;
  let data = $state.raw<Data>();
  let view = $state<View>("A");
  let choice = $state(CHOICES[0]);
  let nodeLimit = $state(500);
  let look = $state.raw({ glow: true, fog: true, spin: false });
  let onScreen = $state.raw<Scene>();
  let readings = $state<number[]>([]);
  let message = $state("");
  let results = $state("");
  const fps = $derived(readings.length ? readings.reduce((a, b) => a + b) / readings.length : undefined);
  const hub = $derived(HUBS[choice]);

  // A later choice wins over a hub still loading.
  let shown = 0;
  async function show() {
    const mine = ++shown;
    message = "";
    let next: Scene;
    if (hub) {
      try {
        await data!.loadWithKin(hub);
      } catch (e) {
        if (mine === shown) message = `${choice} could not be loaded from this export: ${(e as Error).message}`;
        return;
      }
      const s = reduce(initialState(hub), { type: "setFilter", key: "nodeLimit", value: nodeLimit }, data!.label);
      next = scene(s, data!.record, data!.genderOf, data!.bookOf);
    } else next = synthetic(parseInt(choice));
    if (mine !== shown) return;
    onScreen = next;
    graph!.render(onScreen, onScreen.nodes.find((n) => n.role === "focus")!.id);
    readings = [];
  }

  function setView(v: View) {
    view = v;
    graph!.setView(v);
    readings = [];
  }
  function setLook(l: typeof look) {
    look = l;
    graph!.setLook(l);
    readings = [];
  }

  function record() {
    const on = (b: boolean) => (b ? "on" : "off");
    const cells = [view, choice, onScreen!.count, onScreen!.demand, onScreen!.hidden, `glow ${on(look.glow)}`, VIEWS[view].fog ? `fog ${on(look.fog)}` : "no fog", look.spin ? "spinning" : "still"];
    results += cells.map((c, i) => String(c).padEnd(WIDTHS[i])).join("") + `${fps!.toFixed(1)} fps\n`;
  }

  onMount(() => {
    const head = ["view", "scene", "nodes", "demand", "hidden", "glow", "fog", "camera"];
    results = `Node limit test, ${new Date().toISOString().slice(0, 10)}, window ${innerWidth} x ${innerHeight} px, pixel ratio ${devicePixelRatio}\n`;
    results += head.map((c, i) => c.padEnd(WIDTHS[i])).join("") + "frame rate\n";
    try {
      graph = createGraph(host, (id) => data?.label(id) ?? id, (id) => data?.quote(id) ?? "");
    } catch {
      message = "This browser has no WebGL.";
      return;
    }
    graph.onFps((f) => (readings = [...readings, f].slice(-READINGS)));
    show();
    // The hubs need the export; the synthetic scenes do not.
    createData(fetchJSON, "/data").then(
      (d) => (data = d),
      (e) => (message = `Could not load the export, so the hubs are off: ${e.message}`),
    );
    if (import.meta.env.MODE === "e2e") Object.assign(window, { wendGraph: graph }); // the browser tests' build only
    return () => graph?.dispose();
  });
</script>

<div class="stage" bind:this={host}></div>
<div class="controls">
  <h1>Node limit test</h1>
  <div role="radiogroup" aria-label="View">
    View
    {#each Object.keys(VIEWS) as View[] as v (v)}
      <label><input type="radio" name="view" value={v} checked={view === v} onchange={() => setView(v)} />{v}</label>
    {/each}
  </div>
  <label
    >Scene
    <select
      value={choice}
      onchange={(e) => {
        choice = e.currentTarget.value;
        show();
      }}
    >
      <!-- The hubs wait for the export. -->
      {#each CHOICES as c (c)}<option disabled={!data && c in HUBS}>{c}</option>{/each}
    </select>
  </label>
  <label
    >Node limit <input
      type="number"
      min="1"
      value={nodeLimit}
      oninput={(e) => {
        nodeLimit = +e.currentTarget.value;
        show();
      }}
      disabled={!hub}
    /></label
  >
  <div>
    <label><input type="checkbox" checked={look.glow} onchange={(e) => setLook({ ...look, glow: e.currentTarget.checked })} />Glow</label>
    <!-- Only free orbit has fog. -->
    <label><input type="checkbox" checked={look.fog} onchange={(e) => setLook({ ...look, fog: e.currentTarget.checked })} disabled={!VIEWS[view].fog} />Fog</label>
    <label><input type="checkbox" checked={look.spin} onchange={(e) => setLook({ ...look, spin: e.currentTarget.checked })} />Spin the camera</label>
  </div>
  {#if onScreen}
    <p>
      Nodes <b data-testid="nodes">{onScreen.count}</b>, wanted <b data-testid="demand">{onScreen.demand}</b>, hidden
      <b data-testid="hidden">{onScreen.hidden}</b>
    </p>
  {/if}
  <p>
    <b data-testid="fps">{fps === undefined ? "measuring" : `${fps.toFixed(1)} fps`}</b>, mean of the last {readings.length} s.
    The rate cannot pass the display's refresh rate.
  </p>
  {#if message}<p class="message">{message}</p>{/if}
  <button onclick={record} disabled={fps === undefined}>Record</button>
  <button onclick={() => navigator.clipboard.writeText(results)}>Copy</button>
  <label>Results <textarea readonly rows="6" value={results}></textarea></label>
</div>

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
  .controls {
    position: fixed;
    top: 12px;
    left: 12px;
    width: 520px;
    padding: 8px 12px;
    background: rgba(20, 23, 34, 0.92);
    border: 1px solid #262a3c;
  }
  .controls > * {
    margin: 6px 0;
  }
  h1 {
    font-size: 16px;
  }
  label {
    margin-right: 10px;
  }
  textarea {
    display: block;
    width: 100%;
    box-sizing: border-box;
    font: 12px/1.4 ui-monospace, monospace;
    background: #0d0f17;
    color: inherit;
  }
  .message {
    color: #ff9f6e;
  }
</style>
