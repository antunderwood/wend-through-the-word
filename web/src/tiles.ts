// The map's tile provider and library (decision 189). The provider is one setting, so the owner can
// change it if its terms or cost change; its host is the only other one the page contacts, and only
// after the reader presses "Show map". The credits page lists both from here.
export const TILES = {
  name: "OpenStreetMap",
  link: "https://www.openstreetmap.org/copyright",
  licence: "Open Database License (ODbL), tiles under the OSMF Tile Usage Policy",
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  // The attribution as plain text, for the credits page.
  credit: "Map data © OpenStreetMap contributors.",
  maxZoom: 19,
};

export const MAP_LIBRARY = { name: "Leaflet", link: "https://leafletjs.com", licence: "BSD 2-Clause" };
