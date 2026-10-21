import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import "./fixture";

// The live check (decision 154), run against Wrangler's local dev server serving the staged
// fixture site with its own headers file and the repository's Wrangler configuration.
const web = join(import.meta.dirname, "..");
const servers: ChildProcess[] = [];
let url: string;
let version: string;

// Stages the fixture to a new folder and serves it with wrangler dev; returns the folder and the
// server's address. A test that edits its site serves its own, so the others never see the edit.
async function serve(): Promise<{ site: string; url: string }> {
  const site = join(mkdtempSync(join(tmpdir(), "wend-live-")), "site");
  execFileSync("node", ["stage.ts", process.env.WEND_DATA!, site], { cwd: web });
  const server = spawn(join(web, "node_modules", ".bin", "wrangler"), ["dev", "--assets", site, "--ip", "127.0.0.1", "--port", "0"], {
    cwd: web,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  servers.push(server);
  const url = await new Promise<string>((done, fail) => {
    let log = "";
    server.stdout!.on("data", (chunk) => {
      log += chunk;
      const ready = log.match(/Ready on (http\S+)/);
      if (ready) done(ready[1]);
    });
    server.on("exit", () => fail(new Error(`wrangler dev exited:\n${log}`)));
  });
  return { site, url };
}

// The check's exit code and its output, as the deploy workflow or the owner would see them.
async function check(base: string, expected: string, ...flags: string[]): Promise<{ code: number; output: string }> {
  try {
    const { stdout } = await promisify(execFile)("node", ["live-check.ts", base, expected, ...flags], { cwd: web });
    return { code: 0, output: stdout };
  } catch (e) {
    const { code, stdout, stderr } = e as { code: number; stdout: string; stderr: string };
    return { code, output: stdout + stderr };
  }
}

// A plain Node server on a free local port, and its address.
async function listen(local: Server): Promise<string> {
  await new Promise<void>((done) => local.listen(0, "127.0.0.1", done));
  return `http://127.0.0.1:${(local.address() as AddressInfo).port}`;
}

describe("live check", () => {
  beforeAll(async () => {
    const served = await serve();
    url = served.url;
    version = JSON.parse(readFileSync(join(served.site, "data", "index.json"), "utf8")).data_version;
  }, 180_000);

  afterAll(() => {
    for (const server of servers) server.kill();
  });

  it("passes the staged site serving the expected data version", async () => {
    expect(await check(url, version)).toEqual({ code: 0, output: expect.stringContaining("passed") });
  }, 30_000);

  it("fails, naming both versions, when the served data version is not the expected one", async () => {
    const { code, output } = await check(url, "2000-01-01");
    expect(code).not.toBe(0);
    expect(output).toContain(`data version is ${version}, expected 2000-01-01`);
  }, 30_000);

  it("checks the Email Routing MX records only when asked", async () => {
    const { code, output } = await check(url, version, "--email");
    expect(code).not.toBe(0);
    expect(output).toContain("127.0.0.1: no Cloudflare MX records");
  }, 30_000);

  it("lists a failure, not a stack trace, when the site cannot be reached", async () => {
    const closed = createServer();
    const base = await listen(closed);
    closed.close();
    const { code, output } = await check(base, version);
    expect(code).not.toBe(0);
    expect(output).toMatch(/failed:\n- .*ECONNREFUSED/);
    expect(output).not.toMatch(/^\s+at /m);
  }, 30_000);

  it("lists a failure, not a stack trace, when index.json is not JSON", async () => {
    const html = createServer((_, res) => res.end("<!doctype html><p>Not the site</p>"));
    const base = await listen(html);
    const { code, output } = await check(base, version);
    html.close();
    expect(code).not.toBe(0);
    expect(output).toContain("- /data/index.json: not JSON");
    expect(output).not.toMatch(/^\s+at /m);
  }, 30_000);

  it("fails, naming the file, when index.json loses its five minute rule", async () => {
    const own = await serve();
    const headers = join(own.site, "_headers");
    writeFileSync(headers, readFileSync(headers, "utf8").replace(/\/data\/index.json\n.*\n/, ""));
    // Wrangler dev reloads the headers file when it changes.
    await expect
      .poll(async () => (await fetch(`${own.url}/data/index.json`)).headers.get("cache-control"), { timeout: 15_000 })
      .not.toBe("public, max-age=300");
    const { code, output } = await check(own.url, version);
    expect(code).not.toBe(0);
    expect(output).toMatch(/\/data\/index\.json: Cache-Control is .*, expected public, max-age=300/);
    expect((await check(url, version)).code).toBe(0);
  }, 180_000);
});
