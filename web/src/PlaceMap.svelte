<script lang="ts">
  // "Show map" in the Details tab (#84): the Selected Place's dot and name on a map. Nothing is asked
  // of the tile host until the reader presses it, and the first time in a session a notice says what
  // the host sees. Once open, the map stays open and follows the selection.
  import type { Data } from "./data";
  import { typeColour } from "./graph";
  import type { MapPlace, PlaceMap } from "./map";
  import { typeOf, type Id } from "./model";
  import { TILES } from "./tiles";

  let { data, selected, name }: { data: Data; selected: Id; name: string } = $props();

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

  // The Place to show: null when it has none. The last one stays while the next one's point loads,
  // so the map is not made again for each selection. A point that fails to load leaves the panel's
  // own message.
  const isPlace = $derived(typeOf(selected) === "place");
  let place = $state<MapPlace | null>();
  $effect(() => {
    const [id, shown] = [selected, name];
    if (!open || !isPlace) return void (place = undefined);
    data
      .point(id)
      .then((p) => id === selected && (place = p ? { id, name: shown, ...p } : null))
      .catch(() => (place = undefined));
  });

  // The map is made when its box first shows, and removed with it.
  let map = $state<PlaceMap>();
  function draw(host: HTMLElement) {
    let gone = false;
    import("./map").then((m) => gone || (map = m.createMap(host, typeColour("place"))));
    return () => {
      gone = true;
      map?.remove();
      map = undefined;
    };
  }
  $effect(() => {
    if (map && place) map.show([place]);
  });
</script>

<div class="place-map">
  <button aria-expanded={open} onclick={press}>{open ? "Hide map" : "Show map"}</button>
  {#if asking}
    <p class="notice">
      The map's tiles come from {TILES.name}, which sees your address and the area you view.
      <button onclick={accept}>Continue</button>
      <button onclick={() => (asking = false)}>Cancel</button>
    </p>
  {/if}
  {#if open}
    {#if !isPlace}
      <p class="muted">No Place to show.</p>
    {:else if place === null}
      <p class="muted">No point for this Place. Its sources give none, or none this site can use.</p>
    {:else if place}
      <div class="map" role="region" aria-label="Map" {@attach draw}></div>
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
    width: 12px;
    height: 12px;
    border: 2px solid #fff;
    border-radius: 50%;
    box-sizing: border-box;
  }
  .map :global(.dot + span) {
    position: absolute;
    top: -3px;
    left: 16px;
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
