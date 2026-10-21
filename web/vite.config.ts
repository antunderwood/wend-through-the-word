import { defineConfig, type Plugin } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFile } from "node:fs/promises";
import { resolve, normalize } from "node:path";

// Serves the export at /data in dev and preview, from WEND_DATA (default: the repo's out/data).
// The build output never contains data; it is deployed beside the page. Without this, preview
// answers a missing file with index.html, so a failed fetch would not show as one.
const dataDir = resolve(process.env.WEND_DATA ?? resolve(import.meta.dirname, "../out/data"));
function serveData(): Plugin {
  const handler = async (req: { url?: string }, res: import("node:http").ServerResponse, next: () => void) => {
    const url = (req.url ?? "").split("?")[0];
    if (!url.startsWith("/data/")) return next();
    const file = normalize(resolve(dataDir, "." + url.slice("/data".length)));
    if (!file.startsWith(dataDir)) {
      res.statusCode = 403;
      return res.end();
    }
    try {
      const body = await readFile(file);
      res.setHeader("Content-Type", "application/json");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  };
  return {
    name: "serve-data",
    configureServer: (s) => {
      s.middlewares.use(handler);
    },
    configurePreviewServer: (s) => {
      s.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), serveData()],
  // three.js alone is about 520 KB minified.
  // The node limit test page (#30) is a second entry, not linked from the reader's page, and left
  // out of the "site" mode build that stage.ts deploys (decision 156). The credits page is a
  // third, so it loads without WebGL (decision 132).
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        ...(mode !== "site" && { nodelimit: resolve(import.meta.dirname, "node-limit.html") }),
        credits: resolve(import.meta.dirname, "credits.html"),
        notfound: resolve(import.meta.dirname, "404.html"),
      },
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
}));
