import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import { WORKSPACE_DATA_ROOT } from "../config.js";

export interface WorkspacePaths {
  uploadsDir: string;
}

export async function ensureWorkspacePaths(rootDirectory: string = WORKSPACE_DATA_ROOT): Promise<WorkspacePaths> {
  const uploadsDir = path.join(rootDirectory, "uploads");

  await mkdir(uploadsDir, { recursive: true });

  return {
    uploadsDir
  };
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/-+/gu, "-").replace(/^-|-$/gu, "") || "upload";
}
