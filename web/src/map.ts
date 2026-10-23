// The map module (#83): the one place that calls the map library. The panel imports it only when
// the reader first opens the map, so Leaflet adds nothing to the first load and no tile is asked for
// before then. The dots and names are the page's own, drawn over the tiles: when the tiles fail to
// load, they still show on the plain background.
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DOUBLE_CLICK_MS } from "./graph";
import type { Id } from "./model";
import { TILES } from "./tiles";

// role: the Selected Place, drawn larger and ringed, one of its Neighbours, or a stop on the Journey.
export type MapPlace = { id: Id; name: string; lat: number; lon: number; role: "selected" | "neighbour" | "stop" };
export type PlaceMap = ReturnType<typeof createMap>;
// What a dot does: a click selects its Place, a double click makes it the Focus.
export type MapActions = { select: (id: Id) => void; makeFocus: (id: Id) => void };

// A single point is framed at about the scale of a region; Places at several points as close as
// the scale of a town, so that the names of Places a few kilometres apart do not cover each other.
const PLACE_ZOOM = 8;
const NEAR_ZOOM = 11;

export function createMap(host: HTMLElement, colour: string, on: MapActions) {
  // The height of a name, for the names of Places at one point, one under another: on a touch
  // screen a name is a 44 px tap target, so they are 44 px apart.
  const coarse = matchMedia("(pointer: coarse)").matches;
  const LINE = coarse ? 44 : 18;
  // Reduced motion: the map jumps where it would glide (framing, zooming, a flick's drift).
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Leaflet focuses the map on a press. Without preventScroll the panel would scroll the map into
  // view between the press and the release, and the click would miss the dot it began on.
  const focus = host.focus.bind(host);
  host.focus = () => focus({ preventScroll: true });
  // On a touch screen a pinch zooms, and the zoom buttons would cover much of a map as short as
  // the side sheet's.
  const map = L.map(host, { zoomControl: !coarse, zoomAnimation: !still, fadeAnimation: !still, markerZoomAnimation: !still, inertia: !still });
  // The attribution is the tile provider's alone (decision 197): with the library's own "Leaflet"
  // before it, it takes two lines in a wide font and covers the foot of a short map.
  map.attributionControl.setPrefix(false);
  L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: TILES.maxZoom }).addTo(map);
  const dots = L.layerGroup().addTo(map);
  const markers = new Map<Id, L.Marker>();
  // The Journey's line, under the dots; a click passes through it to the map.
  const line = L.polyline([], { className: "journey-line", color: colour, weight: 3, opacity: 0.8, interactive: false });

  // n: how many Places drawn before this one share its point. The first has the dot; each name
  // after it goes one line lower, so no name hides another.
  function dot(p: MapPlace, n: number) {
    const html = document.createElement("span");
    if (!n) {
      const disc = html.appendChild(document.createElement("span"));
      disc.className = "dot";
      disc.style.background = colour;
    }
    const name = html.appendChild(document.createElement("span"));
    name.className = "name";
    name.textContent = p.name;
    name.style.marginTop = `${n * LINE}px`;
    const size = p.role === "selected" ? 18 : 12;
    // Each dot (and each further name at its point) is a button in the tab order, named by its
    // Place; Enter selects at once, as nothing moves under a key as it does under a pointer.
    return L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: `map-place ${p.role}`, html, iconSize: [size, size] }),
      zIndexOffset: p.role === "selected" ? 1000 : 0,
    })
      .on("click", () => clicked(p.id))
      .on("keypress", (e) => (e as L.LeafletKeyboardEvent).originalEvent.key === "Enter" && on.select(p.id));
  }

  // A single click selects only once the double click time (the scene's, decision 192) has passed,
  // because a selection moves the map and the panel under the pointer before a second click could
  // land on the same dot.
  let pending: { id: Id; timer: ReturnType<typeof setTimeout> } | undefined;
  function clicked(id: Id) {
    clearTimeout(pending?.timer);
    if (pending?.id === id) {
      pending = undefined;
      return on.makeFocus(id);
    }
    pending = { id, timer: setTimeout(() => ((pending = undefined), on.select(id)), DOUBLE_CLICK_MS) };
  }

  // The map follows what it shows until the reader pans or zooms it, then stays put until Recentre
  // map or a new selection or view (a new key).
  let shown: MapPlace[] = [];
  let key: string | undefined;
  let follow = true;
  let framing = false;
  map.on("movestart zoomstart", () => framing || (follow = false));
  function frame() {
    const bounds = L.latLngBounds(shown.map((p) => [p.lat, p.lon]));
    framing = true;
    // The framing lasts until the move ends: after a glide, or at once (the first view, a move of
    // nothing, a jump of many zoom levels, reduced motion), so the end is listened for first.
    map.once("moveend", () => (framing = false));
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: bounds.getNorthEast().equals(bounds.getSouthWest()) ? PLACE_ZOOM : NEAR_ZOOM, animate: !still });
  }
  // The box can change size (a message above the map comes or goes, the phone turns): the library
  // fills it again, and a map that follows is framed again.
  const resized = new ResizeObserver(() => {
    map.invalidateSize({ pan: false });
    if (follow && shown.length) frame();
  });
  resized.observe(host);

  return {
    // Draws these Places, the selected one first, and frames the map on them when they are for a
    // new key (the selection and view) or the map is still following.
    show(places: MapPlace[], next: string) {
      if (next !== key) [key, follow] = [next, true];
      shown = places;
      // A dot with the keyboard on it keeps it when the dots are drawn again, if its Place is still shown.
      const had = [...markers].find(([, m]) => m.getElement() === document.activeElement)?.[0];
      dots.clearLayers();
      markers.clear();
      const at = new Map<string, number>();
      // The Selected Place first, so it has the dot (and the ring) at a point it shares.
      for (const p of [...places].sort((a, b) => +(b.role === "selected") - +(a.role === "selected"))) {
        const n = at.get(`${p.lat},${p.lon}`) ?? 0;
        at.set(`${p.lat},${p.lon}`, n + 1);
        markers.set(p.id, dot(p, n).addTo(dots));
      }
      if (follow) frame();
      if (had) markers.get(had)?.getElement()?.focus({ preventScroll: true });
    },
    // Joins these Places with the line, in this order; none clears it.
    join(places: MapPlace[]) {
      if (!places.length) return void line.remove();
      line.setLatLngs(places.map((p) => [p.lat, p.lon])).addTo(map);
    },
    // Frames the map on what it shows again, and follows it again.
    recentre() {
      follow = true;
      frame();
    },
    // Drops a click on a dot still waiting to select, as a selection made elsewhere replaces it.
    cancel() {
      clearTimeout(pending?.timer);
      pending = undefined;
    },
    remove() {
      clearTimeout(pending?.timer);
      resized.disconnect();
      map.remove();
    },
  };
}
