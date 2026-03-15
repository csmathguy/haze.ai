import { readdir, stat } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Encode a local filesystem path into the directory name format Claude Code uses under
 * ~/.claude/projects/. On Windows the drive letter colon is removed, and all path
 * separators (both / and \) are replaced with a single hyphen.
 *
 * Examples:
 *   C:\Users\csmat\source\repos\Taxes  →  C--Users-csmat-source-repos-Taxes
 *   /home/user/repos/Taxes             →  -home-user-repos-Taxes
 */
function encodeProjectPath(cwdPath: string): string {
  return cwdPath.replace(/:/gu, "").replaceAll("\\", "-").replaceAll("/", "-");
}

/**
 * Resolve the tilde home shortcut to an absolute path on any platform.
 */
function resolveHome(filePath: string): string {
  if (filePath.startsWith("~/") || filePath === "~") {
    return path.join(os.homedir(), filePath.slice(1));
  }

  return filePath;
}

/**
 * Return stat mtime for a file, or 0 if the file cannot be stated.
 */
async function safeMtime(filePath: string): Promise<number> {
  try {
    const stats = await stat(filePath);
    return stats.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Locate the Claude Code session JSONL file for the current working directory.
 *
 * Resolution order:
 * 1. CLAUDE_SESSION_FILE environment variable — use directly if set.
 * 2. CLAUDE_SESSION_ID environment variable — look up in the project directory.
 * 3. Most recently modified *.jsonl in ~/.claude/projects/<encoded-cwd>/ (top-level
 *    files only — subagent sessions are excluded).
 *
 * Returns undefined when no session file can be found; never throws.
 */
export async function findCurrentSessionFile(cwd?: string): Promise<string | undefined> {
  // Priority 1: explicit file path env var
  const envFile = process.env.CLAUDE_SESSION_FILE;

  if (envFile !== undefined && envFile.length > 0) {
    return resolveHome(envFile);
  }

  const resolvedCwd = cwd ?? process.cwd();
  const encodedPath = encodeProjectPath(resolvedCwd);
  const projectsDir = path.join(os.homedir(), ".claude", "projects", encodedPath);

  // Priority 2: explicit session ID env var — resolve to a specific file
  const envSessionId = process.env.CLAUDE_SESSION_ID;

  if (envSessionId !== undefined && envSessionId.length > 0) {
    return path.join(projectsDir, `${envSessionId}.jsonl`);
  }

  // Priority 3: find the most recently modified top-level JSONL in the project directory
  try {
    const entries = await readdir(projectsDir, { withFileTypes: true });
    const jsonlFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => path.join(projectsDir, entry.name));

    if (jsonlFiles.length === 0) {
      return undefined;
    }

    const withMtimes = await Promise.all(
      jsonlFiles.map(async (filePath) => ({ filePath, mtime: await safeMtime(filePath) }))
    );

    const sorted = withMtimes.toSorted((a, b) => b.mtime - a.mtime);

    return sorted[0]?.filePath;
  } catch {
    return undefined;
  }
}
