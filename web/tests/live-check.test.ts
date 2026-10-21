import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import "./fixture";

// The live check (decision 154), run against Wrangler's local dev server serving the staged
// fixture site with its own headers file and the repository's Wrangler configuration.
const web = join(import.meta.dirname, "..");
const site = join(mkdtempSync(join(tmpdir(), "wend-live-")), "site");
let server: ChildProcess;
let url: string;
let version: string;

// The check's exit code and its output, as the deploy workflow or the owner would see them.
async function check(expected: string): Promise<{ code: number; output: string }> {
  try {
    const { stdout } = await promisify(execFile)("node", ["live-check.ts", url, expected], { cwd: web });
    return { code: 0, output: stdout };
  } catch (e) {
    const { code, stdout, stderr } = e as { code: number; stdout: string; stderr: string };
    return { code, output: stdout + stderr };
  }
}

describe("live check", () => {
  beforeAll(async () => {
    execFileSync("node", ["stage.ts", process.env.WEND_DATA!, site], { cwd: web });
    version = JSON.parse(readFileSync(join(site, "data", "index.json"), "utf8")).data_version;
    server = spawn(join(web, "node_modules", ".bin", "wrangler"), ["dev", "--assets", site, "--ip", "127.0.0.1", "--port", "0"], {
      cwd: web,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    url = await new Promise((done, fail) => {
      let log = "";
      server.stdout!.on("data", (chunk) => {
        log += chunk;
        const ready = log.match(/Ready on (http\S+)/);
        if (ready) done(ready[1]);
      });
      server.on("exit", () => fail(new Error(`wrangler dev exited:\n${log}`)));
    });
  }, 180_000);

  afterAll(() => {
    server?.kill();
  });

  it("passes the staged site serving the expected data version", async () => {
    expect(await check(version)).toEqual({ code: 0, output: expect.stringContaining("passed") });
  }, 30_000);

  it("fails, naming both versions, when the served data version is not the expected one", async () => {
    const { code, output } = await check("2000-01-01");
    expect(code).not.toBe(0);
    expect(output).toContain(`data version is ${version}, expected 2000-01-01`);
  }, 30_000);

  it("fails, naming the file, when index.json loses its five minute rule", async () => {
    const headers = join(site, "_headers");
    writeFileSync(headers, readFileSync(headers, "utf8").replace(/\/data\/index.json\n.*\n/, ""));
    // Wrangler dev reloads the headers file when it changes.
    await expect
      .poll(async () => (await fetch(`${url}/data/index.json`)).headers.get("cache-control"), { timeout: 15_000 })
      .not.toBe("public, max-age=300");
    const { code, output } = await check(version);
    expect(code).not.toBe(0);
    expect(output).toMatch(/\/data\/index\.json: Cache-Control is .*, expected public, max-age=300/);
  }, 30_000);
});
