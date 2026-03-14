import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

interface PackageJsonWithScripts {
  scripts?: {
    dev?: string;
  };
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const prismaApiPackages = [
  "apps/audit/api/package.json",
  "apps/knowledge/api/package.json",
  "apps/plan/api/package.json",
  "apps/taxes/api/package.json"
] as const;

describe("prisma-backed API dev scripts", () => {
  it("exclude generated Prisma client directories from tsx watch mode", () => {
    for (const relativePath of prismaApiPackages) {
      const packageJson = readPackageJson(relativePath);
      const devScript = packageJson.scripts?.dev;

      expect(devScript, relativePath).toContain("--exclude ../../../node_modules/.prisma/**");
      expect(devScript, relativePath).toContain("--exclude ../../../node_modules/@prisma/client/**");
    }
  });
});

function readPackageJson(relativePath: string): PackageJsonWithScripts {
  const contents = readFileSync(path.join(repoRoot, relativePath), "utf8");

  return JSON.parse(contents) as PackageJsonWithScripts;
}
