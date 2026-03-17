import { existsSync, rmSync } from "node:fs";
import * as path from "node:path";

interface DependencyIntegrityCheck {
  readonly description: string;
  readonly relativePath: string;
}

interface DependencyRepairPlan {
  readonly checks: readonly DependencyIntegrityCheck[];
  readonly packageDirectory: string;
  readonly packageLabel: string;
}

const dependencyRepairPlans: readonly DependencyRepairPlan[] = [
  {
    checks: [
      {
        description: "material package manifest",
        relativePath: "node_modules/@mui/material/package.json"
      },
      {
        description: "material type declarations",
        relativePath: "node_modules/@mui/material/index.d.ts"
      },
      {
        description: "material styles type declarations",
        relativePath: "node_modules/@mui/material/styles/index.d.ts"
      }
    ],
    packageDirectory: "node_modules/@mui/material",
    packageLabel: "@mui/material"
  },
  {
    checks: [
      {
        description: "icons package manifest",
        relativePath: "node_modules/@mui/icons-material/package.json"
      },
      {
        description: "icons createSvgIcon helper",
        relativePath: "node_modules/@mui/icons-material/utils/createSvgIcon.js"
      },
      {
        description: "icons esm createSvgIcon helper",
        relativePath: "node_modules/@mui/icons-material/esm/utils/createSvgIcon.js"
      },
      {
        description: "CloseRounded icon module",
        relativePath: "node_modules/@mui/icons-material/CloseRounded.js"
      },
      {
        description: "CloseRounded esm icon module",
        relativePath: "node_modules/@mui/icons-material/esm/CloseRounded.js"
      },
      {
        description: "ChecklistRtlOutlined icon module",
        relativePath: "node_modules/@mui/icons-material/ChecklistRtlOutlined.js"
      },
      {
        description: "ChecklistRtlOutlined esm icon module",
        relativePath: "node_modules/@mui/icons-material/esm/ChecklistRtlOutlined.js"
      }
    ],
    packageDirectory: "node_modules/@mui/icons-material",
    packageLabel: "@mui/icons-material"
  }
];

interface EnsureDependencyIntegrityInput {
  readonly log: (message: string) => void;
  readonly reinstall: () => Promise<void>;
  readonly repositoryRoot: string;
}

export async function ensureMuiDependencyIntegrity(input: EnsureDependencyIntegrityInput): Promise<void> {
  const failedPlans = getFailedDependencyPlans(input.repositoryRoot);

  if (failedPlans.length === 0) {
    return;
  }

  input.log("Detected incomplete dependency files after npm install.");

  for (const { plan } of failedPlans) {
    const packagePath = path.join(input.repositoryRoot, plan.packageDirectory);

    if (!existsSync(packagePath)) {
      input.log(`- ${plan.packageLabel}: package directory was already missing.`);
      continue;
    }

    rmSync(packagePath, { force: true, recursive: true });
    input.log(`- ${plan.packageLabel}: removed ${plan.packageDirectory} to force reinstall.`);
  }

  await input.reinstall();

  const remainingFailures = getFailedDependencyPlans(input.repositoryRoot);

  if (remainingFailures.length > 0) {
    throw new Error(
      `Dependency integrity repair failed.\n${renderDependencyIntegrityFailures(remainingFailures)}`
    );
  }

  input.log("Dependency integrity checks passed after repair.");
}

function getFailedDependencyPlans(
  repositoryRoot: string
): { failures: DependencyIntegrityCheck[]; plan: DependencyRepairPlan }[] {
  return dependencyRepairPlans
    .map((plan) => ({
      failures: plan.checks.filter((check) => !existsSync(path.join(repositoryRoot, check.relativePath))),
      plan
    }))
    .filter((result) => result.failures.length > 0);
}

function renderDependencyIntegrityFailures(
  failures: { failures: DependencyIntegrityCheck[]; plan: DependencyRepairPlan }[]
): string {
  const lines: string[] = [];

  for (const { plan, failures: missingChecks } of failures) {
    lines.push(`- ${plan.packageLabel}`);

    for (const check of missingChecks) {
      lines.push(`  - missing ${check.description}: ${check.relativePath}`);
    }
  }

  return lines.join("\n");
}
