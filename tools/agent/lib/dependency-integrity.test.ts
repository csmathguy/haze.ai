import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ensureMuiDependencyIntegrity } from "./dependency-integrity.js";

const requiredProbePaths = [
  "node_modules/@mui/material/package.json",
  "node_modules/@mui/material/index.d.ts",
  "node_modules/@mui/material/styles/index.d.ts",
  "node_modules/@mui/icons-material/package.json",
  "node_modules/@mui/icons-material/utils/createSvgIcon.js",
  "node_modules/@mui/icons-material/esm/utils/createSvgIcon.js",
  "node_modules/@mui/icons-material/CloseRounded.js",
  "node_modules/@mui/icons-material/esm/CloseRounded.js",
  "node_modules/@mui/icons-material/ChecklistRtlOutlined.js",
  "node_modules/@mui/icons-material/esm/ChecklistRtlOutlined.js"
] as const;

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("ensureMuiDependencyIntegrity", () => {
  it("does nothing when required probe files exist", async () => {
    const repositoryRoot = createTempRoot();
    createProbeFiles(repositoryRoot);
    let reinstallCount = 0;

    await ensureMuiDependencyIntegrity({
      log: () => undefined,
      reinstall: () => {
        reinstallCount += 1;
        return Promise.resolve();
      },
      repositoryRoot
    });

    expect(reinstallCount).toBe(0);
  });

  it("repairs missing files by removing package directories and reinstalling once", async () => {
    const repositoryRoot = createTempRoot();
    createProbeFile(repositoryRoot, "node_modules/@mui/material/package.json");
    createProbeFile(repositoryRoot, "node_modules/@mui/icons-material/package.json");

    let reinstallCount = 0;

    await ensureMuiDependencyIntegrity({
      log: () => undefined,
      reinstall: () => {
        reinstallCount += 1;
        createProbeFiles(repositoryRoot);
        return Promise.resolve();
      },
      repositoryRoot
    });

    expect(reinstallCount).toBe(1);
  });

  it("throws when probe files are still missing after reinstall", async () => {
    const repositoryRoot = createTempRoot();
    createProbeFile(repositoryRoot, "node_modules/@mui/material/package.json");

    await expect(
      ensureMuiDependencyIntegrity({
        log: () => undefined,
        reinstall: () => Promise.resolve(),
        repositoryRoot
      })
    ).rejects.toThrow("Dependency integrity repair failed.");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "taxes-dependency-integrity-"));
  tempRoots.push(root);
  return root;
}

function createProbeFiles(repositoryRoot: string): void {
  for (const relativePath of requiredProbePaths) {
    createProbeFile(repositoryRoot, relativePath);
  }
}

function createProbeFile(repositoryRoot: string, relativePath: string): void {
  const absolutePath = path.join(repositoryRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, "ok\n", "utf8");
}
