import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export const resolveRepoPath = (
  configuredPath: string | undefined
): string | undefined => {
  if (!configuredPath || configuredPath.trim().length === 0) {
    return undefined;
  }

  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(REPO_ROOT, configuredPath);
};
