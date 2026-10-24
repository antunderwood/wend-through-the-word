// The map's tile provider and library (decisions 189 and 199). The provider is one setting, so the
// owner can change it if its terms or cost change; its host is the only other one the page contacts,
// and only after the reader presses "Show map". The credits page lists it and the library from here.
//
// Esri's Static Basemap Tiles (the ArcGIS Streets style, English labels) need the owner's access
// token, read from VITE_ESRI_TOKEN when the page is built (the Deploy workflow passes the ESRI_TOKEN
// secret; locally, web/.env.local). The token is never in the repository. Built without it (a fork,
// local dev without the file), the page falls back to OpenStreetMap's standard tile server, so the
// map still works and no request carries an empty token. The e2e specs call tileSettings with the
// token the build saw, so they expect whichever provider was built.
export type TileSettings = {
  name: string;
  url: string;
  // Leaflet's defaults are 256 and 0: Esri's tiles are 512 px, one level of detail lower.
  tileSize?: number;
  zoomOffset?: number;
  minZoom?: number;
  maxZoom: number;
  // Shown on the map, on one line (decision 197); a button in it, if any, shows the whole text.
  attribution: string;
  // The credits page's entries: the tile provider, and the map data if that is credited apart.
  credits: { name: string; link: string; credit: string; licence: string; licenceLink?: string }[];
};

const OSM_CREDIT = "Map data © OpenStreetMap contributors.";
const OSM_LINK = "https://www.openstreetmap.org/copyright";
// The Streets style's copyrightText from its /static metadata (read on 2026-10-24; the weekly usage
// check in docs/runbook.md compares it again, as Esri's attribution rules ask).
const ESRI_SOURCES = "Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community";

export function tileSettings(token: string | undefined): TileSettings {
  if (token)
    return {
      name: "Esri",
      // The level comes before the row (y) and then the column (x).
      url: `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/streets/static/tile/{z}/{y}/{x}?language=en&token=${encodeURIComponent(token)}`,
      // A 512 px tile at level z covers what a 256 px tile does at Leaflet zoom z + 1, so the
      // service's levels 0 to 22 are Leaflet's zooms 1 to 23.
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 1,
      maxZoom: 23,
      // "Powered by Esri", then the data sources, cut to one line; the button shows them all.
      attribution: `<span>Powered by <a href="https://www.esri.com">Esri</a> |</span> <button class="sources" aria-expanded="false">${ESRI_SOURCES}</button>`,
      credits: [
        {
          name: "Esri",
          link: "https://www.esri.com",
          credit: `Map tiles (the ArcGIS Streets style, with English labels), loaded only when a reader opens the map. Powered by Esri. ${ESRI_SOURCES}.`,
          licence: "Esri terms of use (ArcGIS Location Platform)",
          licenceLink: "https://www.esri.com/en-us/legal/overview",
        },
        { name: "OpenStreetMap", link: OSM_LINK, credit: `Part of the map data in Esri's tiles. ${OSM_CREDIT}`, licence: "Open Database License (ODbL)" },
      ],
    };
  return {
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: `&copy; <a href="${OSM_LINK}">OpenStreetMap</a> contributors`,
    credits: [
      {
        name: "OpenStreetMap",
        link: OSM_LINK,
        credit: `Map tiles, loaded only when a reader opens the map. ${OSM_CREDIT}`,
        licence: "Open Database License (ODbL), tiles under the OSMF Tile Usage Policy",
      },
    ],
  };
}

// import.meta.env is Vite's; the e2e specs import this file outside Vite, where it is undefined.
export const TILES = tileSettings(import.meta.env?.VITE_ESRI_TOKEN);

export const MAP_LIBRARY = { name: "Leaflet", link: "https://leafletjs.com", licence: "BSD 2-Clause" };
