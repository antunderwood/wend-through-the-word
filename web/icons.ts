// Renders the PNG icons from web/public/icon.svg in Playwright's Chromium (decision 205): icon.png at
// 32 px with the SVG's rounded corners, and apple-touch-icon.png at 180 px with square corners, as
// iOS rounds them itself; icon-192.png and icon-512.png for the web app manifest, and the maskable icon. Usage, from the repository root: node web/icons.ts
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "public");
const svg = readFileSync(join(dir, "icon.svg"), "utf8");
// The square corners come from dropping the rounded rectangle's rx by an exact match, so a changed
// SVG stops here rather than giving a rounded apple-touch-icon.png.
const square = svg.replace(' rx="14"', "");
if (square === svg) throw new Error('web/public/icon.svg has no rx="14" to drop for the square apple-touch-icon.png');
const browser = await chromium.launch();
for (const [file, size, art] of [
  ["icon.png", 32, svg],
  ["apple-touch-icon.png", 180, square],
  ["icon-192.png", 192, svg],
  ["icon-512.png", 512, svg],
] as const) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${art}`);
  await page.screenshot({ path: join(dir, file), omitBackground: true });
  await page.close();
}
// The maskable icon (decision 228) fills the square with the page colour and keeps the art inside
// the central 70%, as Android may crop it to a circle.
{
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(`<style>body{margin:0;background:#0d0f17;display:grid;place-items:center;height:100vh}svg{width:70vw;height:70vh}</style>${square}`);
  await page.screenshot({ path: join(dir, "icon-maskable-512.png") });
  await page.close();
}
await browser.close();
