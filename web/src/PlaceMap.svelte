<script lang="ts">
  // "Show map" in the Details tab (#84): the Selected Place's dot and name on a map. Nothing is asked
  // of the tile host until the reader presses it, and the first time in a session a notice says what
  // the host sees. Once open, the map stays open and follows the selection. The view switch shows
  // the Place alone or with its Neighbours (#85), whose dots select and make the Focus. The map is a
  // block of its own below the Selected Node's section, of one height whatever it shows (#87).
  import type { Data } from "./data";
  import { typeColour } from "./graph";
  import type { MapActions, MapPlace, PlaceMap } from "./map";
  import { passes, typeOf, type Id, type State } from "./model";
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
  const VIEWS = ["Place", "Neighbours"] as const;
  type View = (typeof VIEWS)[number];
  const VIEW = "wend.mapView";
  let view = $state<View>(
    (() => {
      try {
        return sessionStorage.getItem(VIEW) === "Neighbours" ? "Neighbours" : "Place";
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
  let shown = $state<{ key: string; own: boolean; places: MapPlace[] }>();
  $effect(() => {
    const [id, v, f] = [selected, view, filters];
    if (!open || !isPlace) return void (shown = undefined);
    places(id, v, f)
      .then((s) => id === selected && v === view && (shown = s))
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
</script>

<div class="place-map">
  <!-- Recentre map shares the row with Hide map, clear of the map, which on a phone is too short
       for a button over it. -->
  <div class="top">
    <button data-tour="show-map" aria-expanded={open} onclick={press}>{open ? "Hide map" : "Show map"}</button>
    {#if open && isPlace && shown?.places.length}<button onclick={() => map?.recentre()}>Recentre map</button>{/if}
  </div>
  <!-- Asking or open, the box keeps one height whatever it shows (the notice, no Place, no point, a
       load under way, the map), so the lists below it never move between the two clicks of a double
       click. Only Show map and Hide map change its height. -->
  {#if asking || open}
    <div class="box">
      {#if asking}
        <p class="notice">
          The map's tiles come from {TILES.name}, which sees your address and the area you view.
          <button onclick={accept}>Continue</button>
          <button onclick={() => (asking = false)}>Cancel</button>
        </p>
      {:else if !isPlace}
        <p class="muted">No Place to show.</p>
      {:else if shown}
        <div class="bar" role="group" aria-label="Map view">
          {#each VIEWS as v (v)}<button aria-pressed={view === v} onclick={() => choose(v)}>{v}</button>{/each}
        </div>
        {#if !shown.own}<p class="muted">No point for this Place. Its sources give none, or none this site can use.</p>{/if}
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
     fits under the actions held at the sheet's top (decision 193). */
  .box {
    --bar: 30px;
    --map: 300px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: calc(var(--bar) + 6px + var(--map));
    margin-top: 6px;
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
    display: flex;
    gap: 6px;
    height: var(--bar);
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
