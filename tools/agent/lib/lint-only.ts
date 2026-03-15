import { buildChangedFilePlan } from "./changed-files.js";
import type { LoggedCommand, ResolvedCommand } from "./process.js";

export function buildLintOnlyCommands(files: string[], npmCommand: ResolvedCommand): LoggedCommand[] {
  const plan = buildChangedFilePlan(files);
  const commands: LoggedCommand[] = [];

  if (plan.prismaCheck) {
    commands.push({
      args: ["run", "prisma:check"],
      command: npmCommand,
      step: "prisma-check"
    });
  }

  if (plan.lintTargets.length > 0) {
    commands.push({
      args: ["exec", "eslint", "--", "--max-warnings=0", ...plan.lintTargets],
      command: npmCommand,
      step: "lint-changed"
    });
  }

  for (const scope of plan.typecheckScopes) {
    commands.push({
      args: ["run", `typecheck:${scope}`],
      command: npmCommand,
      step: `typecheck-${scope}`
    });
  }

  return commands;
}

export function shouldRunLintOnly(files: string[]): boolean {
  const plan = buildChangedFilePlan(files);

  return plan.prismaCheck || plan.lintTargets.length > 0 || plan.typecheckScopes.length > 0;
}
