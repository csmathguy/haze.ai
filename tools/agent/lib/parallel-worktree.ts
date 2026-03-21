import * as path from "node:path";

export type { MergeMainOutcome } from "./worktree-merge-main.js";
export { mergeMainIntoWorktree } from "./worktree-merge-main.js";

export interface ParallelTaskArgs {
  baseRef: string;
  dependsOn: string[];
  dryRun: boolean;
  force: boolean;
  mergeMain: boolean;
  owner?: string;
  scopes: string[];
  summary: string;
  taskId: string;
  validations: string[];
  worktreeRoot?: string;
}

export interface ParallelTaskPlan {
  baseRef: string;
  boundaries: Boundary[];
  branchName: string;
  dependsOn: string[];
  dryRun: boolean;
  force: boolean;
  localBriefPath: string;
  mergeMain: boolean;
  owner?: string;
  scopes: string[];
  sliceKind: SliceKind;
  summary: string;
  taskId: string;
  validations: string[];
  warnings: string[];
  worktreePath: string;
}

type Boundary = "api" | "docs" | "prisma" | "shared" | "tools" | "web";
type SliceKind = "contract-first" | "docs" | "tooling" | "vertical";

const DEFAULT_WORKTREE_ROOT = ".worktrees";

export function parseParallelTaskArgs(rawArgs: string[]): ParallelTaskArgs {
  const parsed: Partial<ParallelTaskArgs> = {
    baseRef: "HEAD",
    dependsOn: [],
    dryRun: false,
    force: false,
    mergeMain: true,
    scopes: [],
    validations: [],
    worktreeRoot: DEFAULT_WORKTREE_ROOT
  };
  const handlers = createFlagHandlers(parsed);

  for (let index = 0; index < rawArgs.length; index += 1) {
    index += consumeArgument(rawArgs, index, parsed, handlers);
  }

  return finalizeParsedArgs(parsed);
}

type FlagHandler = (value: string) => void;

function createFlagHandlers(parsed: Partial<ParallelTaskArgs>): Record<string, FlagHandler> {
  return {
    "--base": (value) => {
      parsed.baseRef = value;
    },
    "--depends-on": (value) => {
      parsed.dependsOn = [...(parsed.dependsOn ?? []), value];
    },
    "--owner": (value) => {
      parsed.owner = value;
    },
    "--scope": (value) => {
      parsed.scopes = [...(parsed.scopes ?? []), value];
    },
    "--summary": (value) => {
      parsed.summary = value;
    },
    "--task": (value) => {
      parsed.taskId = value;
    },
    "--validate": (value) => {
      parsed.validations = [...(parsed.validations ?? []), value];
    },
    "--worktree-root": (value) => {
      parsed.worktreeRoot = value;
    }
  };
}

function consumeArgument(
  rawArgs: string[],
  index: number,
  parsed: Partial<ParallelTaskArgs>,
  handlers: Record<string, FlagHandler>
): number {
  const current = rawArgs[index];

  if (current === undefined) {
    throw new Error("Unknown empty argument");
  }

  if (current === "--dry-run") {
    parsed.dryRun = true;
    return 0;
  }

  if (current === "--force") {
    parsed.force = true;
    return 0;
  }

  if (current === "--merge-main") {
    parsed.mergeMain = true;
    return 0;
  }

  if (current === "--no-merge-main") {
    parsed.mergeMain = false;
    return 0;
  }

  const handler = handlers[current];

  if (handler === undefined) {
    throw new Error(`Unknown argument: ${current}`);
  }

  handler(readFlagValue(rawArgs, index, current));
  return 1;
}

function finalizeParsedArgs(parsed: Partial<ParallelTaskArgs>): ParallelTaskArgs {
  const taskId = requireValue(parsed.taskId, "Missing required argument --task");
  const summary = requireValue(parsed.summary, "Missing required argument --summary");
  const scopes = requireScopes(parsed.scopes);

  return {
    baseRef: parsed.baseRef ?? "HEAD",
    dependsOn: dedupe(parsed.dependsOn ?? []),
    dryRun: parsed.dryRun ?? false,
    force: parsed.force ?? false,
    mergeMain: parsed.mergeMain ?? false,
    ...(parsed.owner === undefined ? {} : { owner: parsed.owner }),
    scopes: dedupe(scopes),
    summary,
    taskId: normalizeTaskId(taskId),
    validations: dedupe(parsed.validations ?? []),
    worktreeRoot: normalizeRelativePath(parsed.worktreeRoot ?? DEFAULT_WORKTREE_ROOT)
  };
}

function requireValue(value: string | undefined, errorMessage: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(errorMessage);
  }

  return value;
}

function requireScopes(scopes: string[] | undefined): string[] {
  if (scopes === undefined || scopes.length === 0) {
    throw new Error("At least one --scope value is required.");
  }

  return scopes;
}

export function createParallelTaskPlan(args: ParallelTaskArgs, repoRoot: string): ParallelTaskPlan {
  const scopes = dedupe(args.scopes.map(normalizeRelativePath));
  const boundaries = determineBoundaries(scopes);
  const sliceKind = determineSliceKind(boundaries);
  const taskId = normalizeTaskId(args.taskId);
  const worktreeRoot = normalizeRelativePath(args.worktreeRoot ?? DEFAULT_WORKTREE_ROOT);
  const worktreePath = normalizeRelativePath(path.join(repoRoot, worktreeRoot, taskId));

  return {
    baseRef: args.baseRef,
    boundaries,
    branchName: `feature/${taskId}`,
    dependsOn: dedupe(args.dependsOn.map(normalizeTaskId)),
    dryRun: args.dryRun,
    force: args.force,
    localBriefPath: normalizeRelativePath(path.join(worktreePath, ".codex-local", "parallel-task.md")),
    mergeMain: args.mergeMain,
    ...(args.owner === undefined ? {} : { owner: args.owner }),
    scopes,
    sliceKind,
    summary: args.summary.trim(),
    taskId,
    validations: buildValidations(boundaries, args.validations),
    warnings: buildWarnings(boundaries),
    worktreePath
  };
}

export function renderParallelTaskBrief(plan: ParallelTaskPlan): string {
  const owner = plan.owner ?? "unassigned";
  const dependencies = plan.dependsOn.length === 0 ? ["none"] : plan.dependsOn;
  const warnings = plan.warnings.length === 0 ? ["none"] : plan.warnings;

  return [
    `# Parallel Task: ${plan.taskId}`,
    "",
    `Summary: ${plan.summary}`,
    `Owner: ${owner}`,
    `Base Ref: ${plan.baseRef}`,
    `Branch: ${plan.branchName}`,
    `Worktree: ${normalizeRelativePath(plan.worktreePath)}`,
    `Slice Kind: ${plan.sliceKind}`,
    "",
    "Allowed Scope",
    ...plan.scopes.map((scope) => `- ${scope}`),
    "",
    "Dependencies",
    ...dependencies.map((item) => `- ${item}`),
    "",
    "Validation",
    ...plan.validations.map((command) => `- ${command}`),
    "",
    "Warnings",
    ...warnings.map((warning) => `- ${warning}`),
    "",
    "Conflict Avoidance",
    "- Do not edit files outside the allowed scope unless the orchestrator explicitly expands the slice.",
    "- Rebase or merge from the contract-first slice before editing downstream consumers.",
    "- Prefer additive file creation over broad cross-file rewrites when several agents are active.",
    "",
    "Integration Checklist",
    "1. Run the listed validation commands inside this worktree.",
    "2. Summarize interface changes before handing the slice back to the orchestrator.",
    "3. Merge shared-contract slices before UI or API follow-up slices that consume them."
  ].join("\n");
}

function readFlagValue(rawArgs: string[], index: number, flag: string): string {
  const value = rawArgs[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value after ${flag}`);
  }

  return value;
}

function normalizeTaskId(value: string): string {
  const normalized = trimHyphenEdges(value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-"));

  if (normalized.length === 0) {
    throw new Error("Task id must contain at least one letter or number.");
  }

  return normalized;
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll("\\", "/").replaceAll(/\/+/gu, "/").replaceAll(/\/$/gu, "");
}

function trimHyphenEdges(value: string): string {
  let normalized = value;

  while (normalized.startsWith("-")) {
    normalized = normalized.slice(1);
  }

  while (normalized.endsWith("-")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0).map((value) => value.trim()))];
}

function determineBoundaries(scopes: string[]): Boundary[] {
  const boundaries = new Set<Boundary>();

  for (const scope of scopes) {
    if (scope.startsWith("apps/api/")) {
      boundaries.add("api");
      continue;
    }

    if (scope.startsWith("apps/web/")) {
      boundaries.add("web");
      continue;
    }

    if (scope.startsWith("packages/shared/")) {
      boundaries.add("shared");
      continue;
    }

    if (scope.startsWith("prisma/")) {
      boundaries.add("prisma");
      continue;
    }

    if (scope.startsWith("tools/")) {
      boundaries.add("tools");
      continue;
    }

    if (scope.startsWith("docs/")) {
      boundaries.add("docs");
    }
  }

  return [...boundaries];
}

function determineSliceKind(boundaries: Boundary[]): SliceKind {
  if (boundaries.length === 1 && boundaries[0] === "docs") {
    return "docs";
  }

  if (boundaries.length === 1 && boundaries[0] === "tools") {
    return "tooling";
  }

  if (boundaries.includes("shared") || boundaries.includes("prisma")) {
    return "contract-first";
  }

  return "vertical";
}

function buildValidations(boundaries: Boundary[], explicitValidations: string[]): string[] {
  if (explicitValidations.length > 0) {
    return dedupe(explicitValidations);
  }

  const validations: string[] = [];

  if (boundaries.includes("prisma")) {
    validations.push("npm run prisma:check");
  }

  if (boundaries.includes("web")) {
    validations.push("npm run stylelint");
  }

  if (!boundaries.every((boundary) => boundary === "docs")) {
    validations.push("npm run typecheck");
    validations.push("npm test");
  }

  return validations;
}

function buildWarnings(boundaries: Boundary[]): string[] {
  const warnings: string[] = [];

  if ((boundaries.includes("shared") || boundaries.includes("prisma")) && (boundaries.includes("api") || boundaries.includes("web"))) {
    warnings.push("This slice changes shared contracts and app code together. Prefer merging the shared contract first when possible.");
  }

  if (boundaries.includes("web") && (boundaries.includes("api") || boundaries.includes("prisma"))) {
    warnings.push("This slice spans backend and frontend boundaries. Split the work unless a single agent owns the typed contract handoff.");
  }

  if (boundaries.length > 2) {
    warnings.push("This slice touches more than two boundaries. Split it further unless the integration work is inseparable.");
  }

  return warnings;
}
