export interface ChangedFilePlan {
  lintTargets: string[];
  prismaCheck: boolean;
  stylelintTargets: string[];
  testCommand: TestCommand;
  typecheckScopes: TypecheckScope[];
}

export interface TestCommand {
  kind: "arch" | "full" | "none" | "related";
  targets: string[];
}

export type TypecheckScope = "api" | "quality" | "shared" | "web";

export function buildChangedFilePlan(files: string[]): ChangedFilePlan {
  const normalizedFiles = [...new Set(files.map((file) => file.replaceAll("\\", "/")))];
  const lintTargets = normalizedFiles.filter(isLintTarget);
  const stylelintTargets = normalizedFiles.filter(isStylelintTarget);
  const scopeSet = new Set<TypecheckScope>();
  const relatedTestTargets = normalizedFiles.filter(isRelatedTestTarget);

  for (const file of normalizedFiles) {
    if (isRepositoryWideConfig(file)) {
      scopeSet.add("api");
      scopeSet.add("quality");
      scopeSet.add("shared");
      scopeSet.add("web");
      continue;
    }

    if (file.startsWith("apps/api/")) {
      scopeSet.add("api");
      continue;
    }

    if (file.startsWith("apps/web/")) {
      scopeSet.add("web");
      continue;
    }

    if (file.startsWith("packages/shared/")) {
      scopeSet.add("api");
      scopeSet.add("shared");
      scopeSet.add("web");
      continue;
    }

    if (file.startsWith("tools/")) {
      scopeSet.add("quality");
      continue;
    }

    if (file.startsWith("prisma/") || file === "prisma.config.ts") {
      scopeSet.add("api");
      scopeSet.add("quality");
    }
  }

  return {
    lintTargets,
    prismaCheck: normalizedFiles.some(requiresPrismaCheck),
    stylelintTargets,
    testCommand: buildTestCommand(normalizedFiles, relatedTestTargets),
    typecheckScopes: [...scopeSet]
  };
}

function buildTestCommand(files: string[], relatedTargets: string[]): TestCommand {
  if (files.length === 0) {
    return {
      kind: "none",
      targets: []
    };
  }

  if (files.every((file) => isArchitectureRuleFile(file))) {
    return {
      kind: "arch",
      targets: []
    };
  }

  if (files.some((file) => requiresFullTestRun(file))) {
    return {
      kind: "full",
      targets: []
    };
  }

  if (relatedTargets.length > 0) {
    return {
      kind: "related",
      targets: relatedTargets
    };
  }

  return {
    kind: "none",
    targets: []
  };
}

function isLintTarget(file: string): boolean {
  if (file === "eslint.config.mjs" || file.endsWith(".cjs")) {
    return false;
  }

  return /\.(?:cts|mts|ts|tsx|js|mjs|cjs)$/u.test(file);
}

function isStylelintTarget(file: string): boolean {
  return /\.(?:css|scss)$/u.test(file);
}

function isRepositoryWideConfig(file: string): boolean {
  return (
    file === "package.json" ||
    file === "package-lock.json" ||
    file.startsWith("tsconfig") ||
    file === "eslint.config.mjs" ||
    file === "stylelint.config.mjs" ||
    file === "vitest.config.ts"
  );
}

function isArchitectureRuleFile(file: string): boolean {
  return file.startsWith("tools/quality/architecture/");
}

function isRelatedTestTarget(file: string): boolean {
  return /^(?:apps|packages)\/.+\.(?:ts|tsx)$/u.test(file);
}

function isDirectTestFile(file: string): boolean {
  return /\.(?:test|spec)\.(?:ts|tsx)$/u.test(file);
}

function requiresFullTestRun(file: string): boolean {
  return (
    requiresPrismaCheck(file) ||
    isRepositoryWideConfig(file) ||
    file.startsWith("tools/agent/") ||
    (file.startsWith("tools/") && !isArchitectureRuleFile(file)) ||
    isDirectTestFile(file)
  );
}

function requiresPrismaCheck(file: string): boolean {
  return file.startsWith("prisma/") || file === "prisma.config.ts" || file === ".env.example";
}
