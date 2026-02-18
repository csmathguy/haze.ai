import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProjectRecord } from "./projects.js";

interface StoredProjectFile {
  version: number;
  updatedAt: string;
  projects: ProjectRecord[];
}

export class ProjectFileStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<ProjectRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as StoredProjectFile;
      return parsed.projects ?? [];
    } catch {
      return [];
    }
  }

  async save(projects: ProjectRecord[]): Promise<void> {
    const payload: StoredProjectFile = {
      version: 1,
      updatedAt: new Date().toISOString(),
      projects
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), "utf8");
  }
}

