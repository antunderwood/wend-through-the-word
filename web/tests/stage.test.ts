import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "./fixture";

// The staged site (decision 154): the one command stages the fixture export, and the tests read
// the folder that would be deployed. With WEND_SITE set, they read that staged folder instead
// (the deploy workflow points it at the folder it deploys).
const site = process.env.WEND_SITE ?? join(mkdtempSync(join(tmpdir(), "wend-stage-")), "site");
const files = () => readdirSync(site, { recursive: true, encoding: "utf8" }).filter((f) => statSync(join(site, f)).isFile());

// The Cache-Control a path gets from _headers, read the way Workers static assets read it: a
// placeholder matches anything but "/", a splat matches anything, and every matching rule applies,
// its values joined with a comma.
function cacheControl(path: string): string {
  const rules = readFileSync(join(site, "_headers"), "utf8").split(/\n(?=\S)/);
  const values = rules.flatMap((rule) => {
    const [pattern, ...lines] = rule.trim().split("\n");
    const regex = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/:\w+/g, "[^/]+").replace("*", ".*");
    if (!new RegExp(`^${regex}$`).test(path)) return [];
    return lines.map((l) => l.trim().match(/^Cache-Control: (.*)$/i)?.[1] ?? []).flat();
  });
  return values.join(", ");
}

const YEAR = "public, max-age=31536000, immutable";

describe("staged site", () => {
  beforeAll(() => {
    if (process.env.WEND_SITE) return;
    execFileSync("node", ["stage.ts", process.env.WEND_DATA!, site], { cwd: join(import.meta.dirname, "..") });
  }, 120_000);

  it("holds the page, the credits page, and a not found page, but not the node limit page", () => {
    for (const page of ["index.html", "credits.html", "404.html"]) expect(existsSync(join(site, page)), page).toBe(true);
    expect(files().filter((f) => /node-?limit/i.test(f))).toEqual([]);
  });

  it("has a not found page with a short message and a link back to the graph", () => {
    const html = readFileSync(join(site, "404.html"), "utf8");
    expect(html).toContain("<h1>Page not found</h1>");
    expect(html).toContain('<a href="/">Back to the graph</a>');
  });

  it("links the SVG icon, a PNG icon, and an Apple touch icon from every page, all staged", () => {
    const icons = ["/icon.svg", "/icon.png", "/apple-touch-icon.png"];
    for (const page of ["index.html", "credits.html", "404.html"]) {
      const html = readFileSync(join(site, page), "utf8");
      for (const icon of icons) expect(html, page).toContain(`href="${icon}"`);
    }
    for (const icon of icons) expect(existsSync(join(site, icon)), icon).toBe(true);
  });

  it("writes no em or en dashes in the pages", () => {
    for (const page of ["index.html", "credits.html", "404.html"]) expect(readFileSync(join(site, page), "utf8"), page).not.toMatch(/[\u2013\u2014]/);
  });

  it("stays under Cloudflare's free limits: fewer than 20,000 files, none over 25 MiB", () => {
    expect(files().length).toBeLessThan(20_000);
    expect(files().filter((f) => statSync(join(site, f)).size > 25 * 1024 * 1024)).toEqual([]);
  });

  it("has the export under /data, with index.json naming a version folder in the stage", () => {
    const { data_version } = JSON.parse(readFileSync(join(site, "data", "index.json"), "utf8"));
    expect(statSync(join(site, "data", data_version, "search-index.json")).isFile()).toBe(true);
  });

  it("caches versioned data and hashed files for a year, index.json for five minutes, pages not at all", () => {
    const version = JSON.parse(readFileSync(join(site, "data", "index.json"), "utf8")).data_version;
    expect(cacheControl("/data/index.json")).toBe("public, max-age=300");
    expect(cacheControl(`/data/${version}/chapter/Gen/22.json`)).toBe(YEAR);
    expect(cacheControl(`/data/${version}/entity/person/abraham_58.json`)).toBe(YEAR);
    const hashed = files().filter((f) => f.startsWith("assets/"));
    expect(hashed.length).toBeGreaterThan(0);
    for (const f of hashed) expect(cacheControl(`/${f}`), f).toBe(YEAR);
    for (const page of ["/", "/credits"]) expect(cacheControl(page), page).toBe("public, max-age=0, must-revalidate");
  });
});
