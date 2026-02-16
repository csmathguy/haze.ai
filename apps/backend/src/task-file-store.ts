import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { TaskRecord, TaskStatus } from "./tasks.js";

interface StoredTaskFile {
  version: number;
  updatedAt: string;
  tasks: TaskRecord[];
}

export class TaskFileStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<TaskRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoredTaskFile;
      return parsed.tasks ?? [];
    } catch {
      return [];
    }
  }

  async save(tasks: TaskRecord[]): Promise<void> {
    const payload: StoredTaskFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      tasks
    };

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), "utf8");
  }

  async loadTasksFromDocumentation(tasksDir: string): Promise<TaskRecord[]> {
    let entries: Dirent[];
    try {
      entries = await readdir(tasksDir, {
        withFileTypes: true,
        encoding: "utf8"
      });
    } catch {
      return [];
    }

    const folders = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("task-"))
      .map((entry) => entry.name)
      .sort();

    const records: TaskRecord[] = [];

    for (const folder of folders) {
      const taskPath = join(tasksDir, folder, "task.md");
      let content = "";
      try {
        content = await readFile(taskPath, "utf8");
      } catch {
        continue;
      }

      const titleMatch = content.match(/^#\s*Task:\s*(.+)$/m);
      const statusMatch = content.match(/##\s*Status\s*[\r\n]+-\s*`([^`]+)`/m);
      const goalMatch = content.match(/##\s*Goal\s*[\r\n]+([^\r\n]+)/m);

      const title = titleMatch?.[1]?.trim() ?? folder;
      const statusRaw = statusMatch?.[1]?.trim() ?? "backlog";
      const status = this.normalizeStatus(statusRaw);
      const description = goalMatch?.[1]?.trim() ?? "";
      const createdAt = new Date().toISOString();

      records.push({
        id: `doc:${folder}`,
        title,
        description,
        priority: 3,
        status,
        dependencies: [],
        createdAt,
        updatedAt: createdAt,
        startedAt: null,
        completedAt: status === "done" ? createdAt : null,
        dueAt: null,
        tags: ["documentation"],
        metadata: {
          source: "documentation",
          folder
        }
      });
    }

    return records;
  }

  private normalizeStatus(statusRaw: string): TaskStatus {
    switch (statusRaw) {
      case "todo":
      case "ready":
        return "backlog";
      case "in_progress":
        return "implementing";
      case "backlog":
      case "planning":
      case "implementing":
      case "review":
      case "verification":
      case "awaiting_human":
      case "done":
      case "cancelled":
        return statusRaw;
      default:
        return "backlog";
    }
  }
}
