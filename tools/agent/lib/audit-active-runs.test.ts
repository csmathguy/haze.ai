import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface AuditActiveRunsModule {
  getActiveRunId: (workflow: string) => Promise<string | null>;
  setActiveRun: (workflow: string, runId: string, task?: string) => Promise<void>;
}

const originalCwd = process.cwd();
const modulePath = path.join(originalCwd, "tools", "agent", "lib", "audit-active-runs.ts");
let importSequence = 0;

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
    expect(() => parseJson(currentContents)).not.toThrow();

    const artifactNames = await readdir(path.join(tempDirectory, "artifacts", "audit"));
    expect(artifactNames.some((name) => name.startsWith("active-runs.corrupt-") && name.endsWith(".json"))).toBe(true);
  });

});

async function loadModule(): Promise<AuditActiveRunsModule> {
  importSequence += 1;
  const imported: unknown = await import(`${pathToFileURL(modulePath).href}?t=${importSequence.toString()}`);

  return imported as AuditActiveRunsModule;
}

function parseJson(contents: string): unknown {
  return JSON.parse(contents) as unknown;
}
