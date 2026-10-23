// The map module (#83): the one place that touches the map library. The panel imports it only when
// the reader first opens the map, so Leaflet adds nothing to the first load and no tile is asked for
// before then. The dots and names are the page's own, drawn over the tiles: when the tiles fail to
// load, they still show on the plain background.
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Id } from "./model";
import { TILES } from "./tiles";

export type MapPlace = { id: Id; name: string; lat: number; lon: number };
export type PlaceMap = ReturnType<typeof createMap>;

// A single Place is framed at about the scale of a region.
const PLACE_ZOOM = 8;

export function createMap(host: HTMLElement, colour: string) {
  const map = L.map(host);
  L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: TILES.maxZoom }).addTo(map);
  const dots = L.layerGroup().addTo(map);

  function dot(p: MapPlace) {
    const html = document.createElement("span");
    const disc = html.appendChild(document.createElement("span"));
    disc.className = "dot";
    disc.style.background = colour;
    html.appendChild(document.createElement("span")).textContent = p.name;
    return L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "map-place", html, iconSize: [12, 12] }), interactive: false, keyboard: false });
  }

  return {
    // Draws these Places and frames the map on them.
    show(places: MapPlace[]) {
      dots.clearLayers();
      for (const p of places) dot(p).addTo(dots);
      map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lon])), { padding: [24, 24], maxZoom: PLACE_ZOOM, animate: false });
    },
    remove: () => map.remove(),
  };
}
