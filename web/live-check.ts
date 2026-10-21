// Checks a deployed site (decision 154): pages, the not found page, cache rules, compression, the
// data version, and, with --email, that the domain kept its Email Routing MX records (decisions
// 151, 162). Usage: node web/live-check.ts <base URL> <expected data version> [--email]
import { resolveMx } from "node:dns/promises";

const [base, expected, flag] = process.argv.slice(2);
if (!expected) throw new Error("Usage: node web/live-check.ts <base URL> <expected data version> [--email]");

const YEAR = "public, max-age=31536000, immutable";
const failures: string[] = [];

// The Free plan compresses with zstd unless asked for gzip or br; fetch decodes either.
const get = (path: string) => fetch(new URL(path, base), { headers: { "Accept-Encoding": "gzip, br" } });

async function status(path: string, want: number): Promise<Response> {
  const res = await get(path);
  if (res.status !== want) failures.push(`${path}: status ${res.status}, expected ${want}`);
  return res;
}

function cacheControl(path: string, res: Response, want: string) {
  const got = res.headers.get("cache-control");
  if (got !== want) failures.push(`${path}: Cache-Control is ${got}, expected ${want}`);
}

for (const path of ["/", "/credits", "/?focus=Gen.22.2"]) await status(path, 200);
// /404 serves the not found page itself, so an unknown path must answer 404 with the same page.
const notFound = await (await get("/404")).text();
const unknown = await status("/no-such-page", 404);
if ((await unknown.text()) !== notFound) failures.push("/no-such-page: not the not found page");
await status("/node-limit", 404);

const index = await status("/data/index.json", 200);
cacheControl("/data/index.json", index, "public, max-age=300");
const served = (await index.json()).data_version;
if (served !== expected) failures.push(`/data/index.json: data version is ${served}, expected ${expected}`);

for (const path of [`/data/${expected}/chapter/Gen/25.json`, `/data/${expected}/entity/person/abraham_58.json`]) {
  const res = await status(path, 200);
  cacheControl(path, res, YEAR);
  const encoding = res.headers.get("content-encoding");
  if (encoding !== "gzip" && encoding !== "br") failures.push(`${path}: Content-Encoding is ${encoding}, expected gzip or br`);
}

// Attaching the custom domain must not remove Email Routing's records. Only the live domain has
// them, so the deploy workflow asks for this check.
const { hostname } = new URL(base);
if (flag === "--email") {
  const mx = await resolveMx(hostname).catch(() => []);
  if (!mx.some((r) => r.exchange.endsWith(".mx.cloudflare.net")))
    failures.push(`${hostname}: no Cloudflare MX records (${mx.map((r) => r.exchange).join(", ") || "none"})`);
}

if (failures.length) {
  console.error(`Live check of ${base} failed:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  process.exit(1);
}
console.log(`Live check of ${base} passed`);
