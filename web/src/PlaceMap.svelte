<script lang="ts">
  // "Show map" in the Details tab (#84): the Selected Place's dot and name on a map. Nothing is asked
  // of the tile host until the reader presses it, and the first time in a session a notice says what
  // the host sees. Once open, the map stays open and follows the selection. The view switch shows
  // the Place alone or with its Neighbours (#85), whose dots select and make the Focus, or the
  // Journey along Your Path (#86). The map is a block of its own below the Selected Node's section,
  // of one height whatever it shows (#87).
  import type { Data } from "./data";
  import { typeColour } from "./colours";
  import type { MapActions, MapPlace, PlaceMap } from "./map";
  import { topK, TYPE_NAME, typePlural, TYPES, typeOf, type Id, type State } from "./model";
  import { store, stored } from "./storage";
  import { TILES } from "./tiles";

  let { data, model, select, makeFocus }: { data: Data; model: State } & MapActions = $props();
  const selected = $derived(model.selected);
  const filters = $derived(model.filters);

  // The notice is shown once a session (sessionStorage); where storage is blocked, once a page.
  // Continue and Cancel leave the keyboard on Hide map or Show map, the button that asked.
  const TOLD = "wend.mapNotice";
  let open = $state(false);
  let asking = $state(false);
  let accepted = $state(stored(TOLD, "sessionStorage") === "1");
  let toggle = $state<HTMLButtonElement>();
  function press() {
    if (open) open = false;
    else if (accepted) open = true;
    else asking = true;
  }
  function accept() {
    store(TOLD, "1", "sessionStorage");
    [accepted, asking, open] = [true, false, true];
    toggle?.focus();
  }
  function cancel() {
    asking = false;
    toggle?.focus();
  }

  // The view, kept for the session (sessionStorage); where storage is blocked, for the page. The
  // Place view keeps its stored name and shows the reader's label, Location (decision 200).
  const VIEWS = ["Place", "Neighbours", "Journey"] as const;
  type View = (typeof VIEWS)[number];
  const VIEW = "wend.mapView";
  const kept = stored(VIEW, "sessionStorage") as View;
  let view = $state<View>(VIEWS.includes(kept) ? kept : "Place");
  function choose(v: View) {
    view = v;
    store(VIEW, v, "sessionStorage");
  }

  // The Places to show, the Selected Place first, and whether it has a point itself. Neighbours adds
  // its Ring 1 Places as the scene draws a Focus's: the top K after the filters, no Overflow
  // (decision 192). The last ones stay while the next ones load, so the map is not made again for
  // each selection. A point that fails to load leaves the panel's own message.
  const isPlace = $derived(typeOf(selected) === "place");
  // line: the Places are a Journey, joined in order. note: a line under the switch.
  type Shown = { key: string; own: boolean; places: MapPlace[]; line?: boolean; note?: string };
  let shown = $state<Shown>();
  // Your Path in Path order, the Focus its last stop, as Prev and Next step along it.
  const path = $derived([...model.path, model.focus]);
  $effect(() => {
    const [id, v, f, p] = [selected, view, filters, path];
    if (!open) return void (shown = undefined);
    // A late answer, kept or failed, leaves alone what a newer selection or view shows.
    const current = () => id === selected && v === view && p === path;
    (!isPlace ? fallback(id, f, p) : v === "Journey" ? journey(id, p) : places(id, v, f))
      .then((s) => current() && (shown = s))
      .catch(() => current() && (shown = undefined));
  });
  async function places(id: Id, v: View, f: State["filters"]) {
    const ring = v === "Neighbours" ? topK(await data.load(id), "place", f.k, f, data.bookOf) : [];
    const [own, ...others] = await Promise.all([
      data.point(id),
      ...ring.map((l) => data.point(l.id).catch(() => undefined)), // a Neighbour that fails to load is left out
    ]);
    const at = (p: Id, role: MapPlace["role"], pt?: { lat: number; lon: number }) => pt && { id: p, name: data.label(p), role, ...pt };
    const all = [at(id, "selected", own), ...ring.map((l, i) => at(l.id, "neighbour", others[i]))];
    return { key: `${id}|${v}`, own: !!own, places: all.filter((p) => !!p) };
  }

  // Journey (#86): the Places on Your Path that have points, in Path order, the Selected one ringed.
  // Every other entry is skipped and counted by type; under two Places there is no line to draw.
  async function journey(id: Id, p: Id[]): Promise<Shown> {
    const stops = p.filter((x) => typeOf(x) === "place");
    const points = await Promise.all(stops.map((x) => data.point(x).catch(() => undefined)));
    const places = stops.flatMap((x, i) => {
      const pt = points[i];
      return pt ? [{ id: x, name: data.label(x), role: x === id ? ("selected" as const) : ("stop" as const), ...pt }] : [];
    });
    const key = `${id}|Journey|${p.join()}`;
    if (places.length < 2) return { key, own: true, places: [], note: `Fewer than two ${typePlural("place")} on Your Path have points, so there is no Journey to draw.` };
    const drawn = new Set(places.map((x) => x.id));
    const counts = TYPES.map((t) => {
      const n = p.filter((x) => typeOf(x) === t && !drawn.has(x)).length;
      const name = `${n > 1 ? typePlural(t) : TYPE_NAME[t]}${t === "place" ? " with no point" : ""}`;
      return n ? `${n} ${name}` : "";
    }).filter(Boolean);
    const list = counts.length > 1 ? `${counts.slice(0, -1).join(", ")} and ${counts.at(-1)}` : counts[0];
    return { key, own: true, places, line: true, note: list && `Skipped ${list} on Your Path.` };
  }

  // A Selected Node that is not a Place (#83): the Journey if it has two Places or more, else the
  // Focus's Neighbours if the Focus is a Place, else nothing.
  async function fallback(id: Id, f: State["filters"], p: Id[]): Promise<Shown> {
    const j = await journey(id, p);
    if (j.places.length) return j;
    const focus = p[p.length - 1];
    if (typeOf(focus) === "place") {
      const n = await places(focus, "Neighbours", f);
      if (n.places.length) return { ...n, key: `${id}|${n.key}`, own: true, note: `The Focus, ${data.label(focus)}, and its Neighbours.` };
    }
    return { key: `${id}|none`, own: true, places: [], note: `No ${TYPE_NAME.place} to show.` };
  }

  // The map is made when its box first shows, and removed with it.
  let map = $state.raw<PlaceMap>();
  function draw(host: HTMLElement) {
    let gone = false;
    import("./map").then((m) => gone || (map = m.createMap(host, typeColour("place"), { select: (id) => select(id), makeFocus: (id) => makeFocus(id) })));
    return () => {
      gone = true;
      map?.remove();
      map = undefined;
    };
  }
  $effect(() => {
    if (map && shown?.places.length) map.show(shown.places, shown.key);
  });
  $effect(() => map?.join(shown?.line ? shown.places : []));
  // A selection made elsewhere (a list, the search) drops a click on a dot still waiting to select.
  $effect(() => {
    selected;
    map?.cancel();
  });
</script>

<div class="place-map">
  <!-- Recentre map shares the row with Hide map, clear of the map, which on a phone is too short
       for a button over it. -->
  <div class="top">
    <button data-tour="show-map" aria-expanded={open} onclick={press} bind:this={toggle}>{open ? "Hide map" : "Show map"}</button>
    {#if open && shown?.places.length}<button onclick={() => map?.recentre()}>Recentre map</button>{/if}
  </div>
  <!-- Asking or open, the box keeps one height whatever it shows (the notice, a message, a load
       under way, the map), so the lists below it never move between the two clicks of a double
       click. Only Show map, Hide map, Continue, and Cancel change its height (decision 194). -->
  {#if asking || open}
    <div class="box">
      {#if asking}
        <p class="notice" role="status">
          The map's tiles come from {TILES.name}, which sees your address and the area you view.
          <button onclick={accept}>Continue</button>
          <button onclick={cancel}>Cancel</button>
        </p>
      {:else if shown}
        <div class="bar">
          <!-- A Selected Node that is not a Place gets #83's default view, with no switch. -->
          {#if isPlace}<div role="group" aria-label="Map view">
              {#each VIEWS as v (v)}<button aria-pressed={view === v} onclick={() => choose(v)}>{v === "Place" ? TYPE_NAME.place : v}</button>{/each}
            </div>{/if}
        </div>
        {#if !shown.own}<p class="muted">No point for this {TYPE_NAME.place}. Its sources give none, or none this site can use.</p>{/if}
        {#if shown.note}<p class="muted">{shown.note}</p>{/if}
        {#if shown.places.length}
          <!-- The text list names the Places drawn, for a screen reader. -->
          <div class="map" role="region" aria-label="Map" {@attach draw}></div>
          <ul class="text" aria-label="Shown on the map">
            {#each shown.places as p (p.id)}<li>{p.name}{p.role === "selected" ? " (selected)" : ""}</li>{/each}
          </ul>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .place-map {
    margin: 8px 0;
  }
  /* The view switch's row (--bar) and the map (--map) set the box's one height: on a desktop the map
     is about 300 px; in the phone's sheet less, and less again in the side sheet, so that the box
     fits under the actions held at the sheet's top (decision 194). A message above the map takes
     its room from the map. */
  .box {
    --bar: 30px;
    --map: 300px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: calc(var(--bar) + 6px + var(--map));
    margin-top: 6px;
    overflow: hidden;
  }
  :global(html[data-phone]) .box {
    --bar: 44px;
    --map: 240px;
  }
  :global(html[data-side]) .box {
    --map: 116px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }
  .notice {
    margin: 0;
    font-size: 13px;
  }
  .bar {
    flex: none;
    height: var(--bar);
  }
  .bar > div {
    display: flex;
    gap: 6px;
  }
  .box > .muted {
    margin: 0;
  }
  /* For a screen reader only: the names of the Places on the map. */
  .text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  [aria-pressed="true"] {
    background: #3a4060;
    border-color: #ffd27a;
  }
  .muted {
    color: #9aa0b4;
  }
  /* A plain background, under the tiles and in their place when they fail to load. Its own stacking
     context keeps the library's layers (z-index up to 1000) under the rest of the page, such as the
     actions held at the top of the phone's sheet when the map scrolls under them. */
  .map {
    flex: 1;
    min-height: 0;
    isolation: isolate;
    border-radius: 4px;
    background: #1b1f2d;
    font: inherit;
  }
  /* The tiles are not dimmed (decision 196): the owner chose Esri's as they are. */
  .map :global(.leaflet-tile-pane) {
    filter: none;
  }
  .map :global(.map-place) {
    overflow: visible;
    white-space: nowrap;
  }
  .map :global(.dot) {
    display: block;
    width: 100%;
    height: 100%;
    border: 2px solid #fff;
    border-radius: 50%;
    box-sizing: border-box;
  }
  /* The Selected Place's ring; map.ts draws its dot larger. */
  .map :global(.selected .dot) {
    box-shadow: 0 0 0 3px #ffd27a;
  }
  /* On a touch screen a dot and a name are each at least 44 px to tap, though drawn smaller. */
  :global(html[data-coarse]) .map :global(.dot) {
    position: relative;
  }
  :global(html[data-coarse]) .map :global(.dot::before),
  :global(html[data-coarse]) .map :global(.map-place .name::before) {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: max(100%, 44px);
    height: 44px;
    translate: -50% -50%;
  }
  .map :global(.map-place .name) {
    position: absolute;
    top: calc(50% - 10px);
    left: calc(100% + 4px);
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(13, 15, 23, 0.8);
    color: #e8eaf2;
    font-size: 13px;
  }
  /* The attribution is one line at 12 px, the library's own size and the least Esri recommends: on
     two lines it covers the Selected Place's tap area in the side sheet's map (decision 197). The
     corner spans the map, so Esri's sources are cut to its width, and their button shows them all
     (decision 199). */
  .map :global(.leaflet-bottom.leaflet-right) {
    left: 0;
  }
  .map :global(.leaflet-control-attribution) {
    max-width: 100%;
    box-sizing: border-box;
    background: rgba(13, 15, 23, 0.8);
    color: #c8cde0;
    font-size: 12px;
  }
  .map :global(.leaflet-control-attribution:has(.sources)) {
    display: flex;
    gap: 0.3em;
    white-space: nowrap;
  }
  /* One line high even in the phone's sheet, whose buttons are otherwise 44 px tall: a taller
     button would cover the foot of the map as two lines do. */
  .map :global(.leaflet-control-attribution .sources) {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .map :global(.leaflet-control-attribution.open .sources) {
    white-space: normal;
  }
  .map :global(.leaflet-control-attribution a) {
    color: #ffd27a;
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
</style>
