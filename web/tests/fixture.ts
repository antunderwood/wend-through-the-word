import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The export built from the fixture sources (tests/conftest.py run_build), so the front end tests
// check the same data contract as the build tests. CI builds it; see .github/workflows/ci.yml.
const root = process.env.WEND_DATA;
if (!root) throw new Error("Set WEND_DATA to the data folder of an export built from the fixture sources");

export const readExport = async (url: string): Promise<unknown> => JSON.parse(await readFile(join(root, url), "utf8"));
