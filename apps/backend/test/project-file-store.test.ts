import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { ProjectFileStore } from "../src/project-file-store.js";

describe("ProjectFileStore", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test("saves and loads project records from json file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haze-project-store-"));
    tempDirs.push(dir);

    const filePath = join(dir, "projects.json");
    const store = new ProjectFileStore(filePath);

    await store.save([
      {
        id: "project-1",
        name: "General",
        description: "Default",
        repository: "",
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        metadata: {}
      }
    ]);

    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("project-1");

    const raw = await readFile(filePath, "utf8");
    expect(raw).toContain('"version": 1');
  });
});

