// Stages the folder that is deployed to Workers static assets (decisions 154, 156, 157): the
// page's "site" mode build (no node limit page), the export under /data, and the headers file.
// Usage, from the repository root: node web/stage.ts <export data folder> <site folder>
import { build } from "vite";
import { cpSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { FIVE_MINUTES, REVALIDATE, YEAR } from "./cache-rules.ts";

const [data, site] = process.argv.slice(2).map((p) => resolve(p));
if (!site) throw new Error("Usage: node web/stage.ts <export data folder> <site folder>");

await build({ root: import.meta.dirname, mode: "site", logLevel: "warn", build: { outDir: site, emptyOutDir: true } });
cpSync(data, join(site, "data"), { recursive: true });

// Cloudflare joins the values of every rule a path matches, so no two rules may overlap: the
// placeholder in /data/:version/* never matches the "/" of /data/index.json. Vite's hashed files
// are under /assets. The HTML rule is Cloudflare's default, written out so the rule is ours.
writeFileSync(
  join(site, "_headers"),
  `/data/:version/*
  Cache-Control: ${YEAR}
/assets/*
  Cache-Control: ${YEAR}
/data/index.json
  Cache-Control: ${FIVE_MINUTES}
/
  Cache-Control: ${REVALIDATE}
/credits
  Cache-Control: ${REVALIDATE}
`,
);
