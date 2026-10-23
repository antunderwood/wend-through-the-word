<script lang="ts">
  // "Show map" in the Details tab (#84): the Selected Place's dot and name on a map. Nothing is asked
  // of the tile host until the reader presses it, and the first time in a session a notice says what
  // the host sees. Once open, the map stays open and follows the selection. The view switch shows
  // the Place alone or with its Neighbours (#85), whose dots select and make the Focus, or the
  // Journey along Your Path (#86).
  import type { Data } from "./data";
  import { typeColour } from "./graph";
  import type { MapActions, MapPlace, PlaceMap } from "./map";
  import { passes, TYPE_NAME, TYPES, typeOf, type Id, type State } from "./model";
  import { TILES } from "./tiles";

  let { data, model, select, makeFocus }: { data: Data; model: State } & MapActions = $props();
  const selected = $derived(model.selected);
  const filters = $derived(model.filters);

  // The notice is shown once a session (sessionStorage); where storage is blocked, once a page.
  const TOLD = "wend.mapNotice";
  const told = () => {
    try {
      return sessionStorage.getItem(TOLD) === "1";
    } catch {
      return false;
    }
  };
  let open = $state(false);
  let asking = $state(false);
  let accepted = $state(told());
  function press() {
    if (open) open = false;
    else if (accepted) open = true;
    else asking = true;
  }
  function accept() {
    try {
      sessionStorage.setItem(TOLD, "1");
    } catch {
      // once a page
    }
    [accepted, asking, open] = [true, false, true];
  }

  // The view, kept for the session (sessionStorage); where storage is blocked, for the page.
  const VIEWS = ["Place", "Neighbours", "Journey"] as const;
  type View = (typeof VIEWS)[number];
  const VIEW = "wend.mapView";
  let view = $state<View>(
    (() => {
      try {
        const kept = sessionStorage.getItem(VIEW) as View;
        return VIEWS.includes(kept) ? kept : "Place";
      } catch {
        return "Place";
      }
    })(),
  );
  function choose(v: View) {
    view = v;
    try {
      sessionStorage.setItem(VIEW, v);
    } catch {
      // for the page
    }
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
    (!isPlace ? fallback(id, f, p) : v === "Journey" ? journey(id, p) : places(id, v, f))
      .then((s) => id === selected && v === view && p === path && (shown = s))
      .catch(() => (shown = undefined));
  });
  async function places(id: Id, v: View, f: State["filters"]) {
    const ring = v === "Neighbours" ? (await data.load(id)).links.filter((l) => l.type === "place" && l.id !== id && passes(l, f, data.bookOf)).slice(0, f.k) : [];
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
    if (places.length < 2) return { key, own: true, places: [], note: "Fewer than two Places on Your Path have points, so there is no Journey to draw." };
    const drawn = new Set(places.map((x) => x.id));
    const counts = TYPES.map((t) => {
      const n = p.filter((x) => typeOf(x) === t && !drawn.has(x)).length;
      const name = t === "place" ? `Place${n > 1 ? "s" : ""} with no point` : `${TYPE_NAME[t]}${n > 1 ? "s" : ""}`;
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
    return { key: `${id}|none`, own: true, places: [], note: "No Place to show." };
  }

  // The map is made when its box first shows, and removed with it.
  let map = $state<PlaceMap>();
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
</script>

<div class="place-map">
  <button data-tour="show-map" aria-expanded={open} onclick={press}>{open ? "Hide map" : "Show map"}</button>
  {#if asking}
    <p class="notice">
      The map's tiles come from {TILES.name}, which sees your address and the area you view.
      <button onclick={accept}>Continue</button>
      <button onclick={() => (asking = false)}>Cancel</button>
    </p>
  {/if}
  {#if open}
    {#if shown}
      <div class="bar">
        <!-- A Selected Node that is not a Place gets #83's default view, with no switch. -->
        {#if isPlace}<div role="group" aria-label="Map view">
            {#each VIEWS as v (v)}<button aria-pressed={view === v} onclick={() => choose(v)}>{v}</button>{/each}
          </div>{/if}
        {#if shown.places.length}<button onclick={() => map?.recentre()}>Recentre map</button>{/if}
      </div>
      {#if !shown.own}<p class="muted">No point for this Place. Its sources give none, or none this site can use.</p>{/if}
      {#if shown.note}<p class="muted">{shown.note}</p>{/if}
      {#if shown.places.length}<div class="map" role="region" aria-label="Map" {@attach draw}></div>{/if}
    {/if}
  {/if}
</div>

<style>
  .place-map {
    margin: 8px 0;
  }
  .notice {
    font-size: 13px;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px;
    margin-top: 6px;
  }
  [aria-pressed="true"] {
    background: #3a4060;
    border-color: #ffd27a;
  }
  .muted {
    color: #9aa0b4;
  }
  /* A plain background, under the tiles and in their place when they fail to load. */
  .map {
    height: 200px;
    margin-top: 6px;
    border-radius: 4px;
    background: #1b1f2d;
    font: inherit;
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
  /* The Selected Place: larger, and ringed. */
  .map :global(.selected .dot) {
    box-shadow: 0 0 0 3px #ffd27a;
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
  .map :global(.leaflet-control-attribution) {
    background: rgba(13, 15, 23, 0.8);
    color: #c8cde0;
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
