import { describe, expect, it } from "vitest";
import { tileSettings } from "../src/tiles";

// The map's tile provider (decision 199): Esri with the build's token, else OpenStreetMap, so a
// build without a token never asks Esri for a tile with an empty one.
describe("the tile provider follows the build's token", () => {
  it("is Esri's Streets style in English with a token, the level before the row and column", () => {
    const t = tileSettings("a b");
    expect(t.name).toBe("Esri");
    expect(t.url).toBe(
      "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/streets/static/tile/{z}/{y}/{x}?language=en&token=a%20b",
    );
    expect([t.tileSize, t.zoomOffset, t.minZoom, t.maxZoom]).toEqual([512, -1, 1, 23]);
    expect(t.attribution).toMatch(/^<span>Powered by <a href="https:\/\/www\.esri\.com">Esri<\/a> \|<\/span> <button class="sources"/);
  });

  it.each([undefined, ""])("falls back to OpenStreetMap with no Esri host or token when the token is %j", (token) => {
    const t = tileSettings(token);
    expect(t.name).toBe("OpenStreetMap");
    expect(t.url).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(JSON.stringify(t)).not.toMatch(/arcgis|token/);
  });
});
