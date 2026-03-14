import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const modulePath = path.join(originalCwd, "tools", "agent", "lib", "audit-active-runs.ts");

describe("active run registry", () => {
  let tempDirectory = "";

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), "taxes-active-runs-"));
    process.chdir(tempDirectory);
    vi.restoreAllMocks();
    vi.spyOn(process, "cwd").mockImplementation(() => tempDirectory);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    await rm(tempDirectory, { force: true, recursive: true });
  });

  it("quarantines malformed active-runs state and recovers with a clean registry", async () => {
    await mkdir(path.join(tempDirectory, "artifacts", "audit"), { recursive: true });
    await writeFile(path.join(tempDirectory, "artifacts", "audit", "active-runs.json"), '{ "broken": true }\n}\n');

    const activeRuns = await loadModule();
    await activeRuns.setActiveRun("implementation", "run-1", "repair");

    expect(await activeRuns.getActiveRunId("implementation")).toBe("run-1");

    const currentContents = await readFile(path.join(tempDirectory, "artifacts", "audit", "active-runs.json"), "utf8");
    expect(() => JSON.parse(currentContents)).not.toThrow();

    const artifactNames = await readdir(path.join(tempDirectory, "artifacts", "audit"));
    expect(artifactNames.some((name) => name.startsWith("active-runs.corrupt-") && name.endsWith(".json"))).toBe(true);
  });

  it("serializes concurrent updates without corrupting the registry", async () => {
    const activeRuns = await loadModule();

    await Promise.all(
      Array.from({ length: 10 }, (_, index) => activeRuns.setActiveRun(`workflow-${index.toString()}`, `run-${index.toString()}`))
    );

    for (let index = 0; index < 10; index += 1) {
      await expect(activeRuns.getActiveRunId(`workflow-${index.toString()}`)).resolves.toBe(`run-${index.toString()}`);
    }

    const currentContents = await readFile(path.join(tempDirectory, "artifacts", "audit", "active-runs.json"), "utf8");
    expect(() => JSON.parse(currentContents)).not.toThrow();
  });
});

async function loadModule() {
  const imported = await import(`${pathToFileURL(modulePath).href}?t=${Date.now().toString()}-${Math.random().toString(16).slice(2)}`);

  return imported as typeof import("./audit-active-runs.js");
}
