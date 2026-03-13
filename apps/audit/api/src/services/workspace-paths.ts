import { existsSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";

export interface AuditWorkspacePaths {
  repoPath?: string;
  worktreePath: string;
}

const workspaceCache = new Map<string, AuditWorkspacePaths>();

export function resolveAuditWorkspacePaths(cwd: string): AuditWorkspacePaths {
  const normalizedCwd = path.resolve(cwd);
  const cached = workspaceCache.get(normalizedCwd);

  if (cached !== undefined) {
    return cached;
  }

  const resolved = detectWorkspacePaths(normalizedCwd);
  workspaceCache.set(normalizedCwd, resolved);

  return resolved;
}

function detectWorkspacePaths(cwd: string): AuditWorkspacePaths {
  let currentPath = cwd;

  while (true) {
    const gitEntryPath = path.join(currentPath, ".git");

    if (existsSync(gitEntryPath)) {
      const gitEntry = statSync(gitEntryPath);

      if (gitEntry.isDirectory()) {
        return {
          repoPath: currentPath,
          worktreePath: currentPath
        };
      }

      const gitDirectory = readGitDirectoryFromPointer(gitEntryPath);

      if (gitDirectory !== null) {
        const repoPath = resolveRepoPath(gitDirectory);

        return {
          worktreePath: currentPath,
          ...(repoPath === undefined ? {} : { repoPath })
        };
      }
    }

    const parentPath = path.dirname(currentPath);

    if (parentPath === currentPath) {
      return {
        worktreePath: cwd
      };
    }

    currentPath = parentPath;
  }
}

function readGitDirectoryFromPointer(gitPointerPath: string): string | null {
  const contents = readFileSync(gitPointerPath, "utf8").trim();

  if (!contents.toLowerCase().startsWith("gitdir:")) {
    return null;
  }

  return path.resolve(path.dirname(gitPointerPath), contents.slice("gitdir:".length).trim());
}

function resolveRepoPath(gitDirectory: string): string | undefined {
  const commonDirFilePath = path.join(gitDirectory, "commondir");

  if (!existsSync(commonDirFilePath)) {
    return path.basename(gitDirectory).toLowerCase() === ".git" ? path.dirname(gitDirectory) : undefined;
  }

  const relativeCommonDir = readFileSync(commonDirFilePath, "utf8").trim();
  const commonDirPath = path.resolve(gitDirectory, relativeCommonDir);

  return path.basename(commonDirPath).toLowerCase() === ".git" ? path.dirname(commonDirPath) : commonDirPath;
}
