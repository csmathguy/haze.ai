import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { TaskFileStore } from "../src/task-file-store.js";

describe("TaskFileStore", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test("saves and loads task records from json file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haze-task-store-"));
    tempDirs.push(dir);

    const filePath = join(dir, "tasks.json");
    const store = new TaskFileStore(filePath);

    await store.save([
      {
        id: "t1",
        title: "Task",
        description: "desc",
        priority: 3,
        status: "backlog",
        dependencies: [],
        createdAt: "2026-02-16T00:00:00.000Z",
        updatedAt: "2026-02-16T00:00:00.000Z",
        startedAt: null,
        completedAt: null,
        dueAt: null,
        tags: [],
        metadata: {}
      }
    ]);

    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("t1");

    const raw = await readFile(filePath, "utf8");
    expect(raw).toContain('"version": 1');
  });

  test("extracts tasks from documentation task folders", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haze-task-docs-"));
    tempDirs.push(dir);

    const docsRoot = join(dir, "documentation", "tasks");
    const folder = join(docsRoot, "task-sample");
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, "task.md"),
      "# Task: Sample Task\n\n## Status\n- `implementing`\n\n## Goal\nShip sample feature\n",
      "utf8"
    );

    const store = new TaskFileStore(join(dir, "tasks.json"));
    const records = await store.loadTasksFromDocumentation(docsRoot);

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("doc:task-sample");
    expect(records[0].status).toBe("implementing");
    expect(records[0].title).toBe("Sample Task");
  });

  test("returns empty tasks when documentation folder does not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haze-task-docs-missing-"));
    tempDirs.push(dir);

    const docsRoot = join(dir, "documentation", "tasks");
    const store = new TaskFileStore(join(dir, "tasks.json"));
    const records = await store.loadTasksFromDocumentation(docsRoot);

    expect(records).toEqual([]);
  });
});
