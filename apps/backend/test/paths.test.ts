import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { resolveRepoPath } from "../src/paths.js";

describe("resolveRepoPath", () => {
  const expectedDocsRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../documentation/tasks"
  );

  test("returns undefined when path is not configured", () => {
    expect(resolveRepoPath(undefined)).toBeUndefined();
  });

  test("resolves configured relative path from repository root", () => {
    expect(resolveRepoPath("documentation/custom")).toBe(
      resolve(dirname(expectedDocsRoot), "custom")
    );
  });

  test("returns absolute configured path unchanged", () => {
    const absolute = resolve(dirname(expectedDocsRoot), "test-fixture");
    expect(resolveRepoPath(absolute)).toBe(absolute);
  });
});
