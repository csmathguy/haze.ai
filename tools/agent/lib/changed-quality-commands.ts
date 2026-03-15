import { buildChangedFilePlan } from "./changed-files.js";
import type { LoggedCommand, ResolvedCommand } from "./process.js";
import { shouldRunLintOnly } from "./lint-only.js";

export function buildChangedQualityCommands(files: string[], npmCommand: ResolvedCommand, pool?: string): LoggedCommand[] {
  const normalizedFiles = [...new Set(files.map((file) => file.replaceAll("\\", "/")))];
  const plan = buildChangedFilePlan(normalizedFiles);
  const commands: LoggedCommand[] = [];

  if (shouldRunLintOnly(normalizedFiles)) {
    commands.push({
      args: ["run", "quality:lint-only", "--", ...normalizedFiles],
      command: npmCommand,
      step: "lint-preflight"
    });
  }

  if (plan.stylelintTargets.length > 0) {
    commands.push({
      args: ["exec", "stylelint", "--", "--allow-empty-input", ...plan.stylelintTargets],
      command: npmCommand,
      step: "stylelint-changed"
    });
  }

  commands.push(...buildTestCommands(npmCommand, plan, pool));

  return commands;
}

function buildTestCommands(npmCommand: ResolvedCommand, plan: ReturnType<typeof buildChangedFilePlan>, pool?: string): LoggedCommand[] {
  switch (plan.testCommand.kind) {
    case "arch":
      return [
        {
          args: ["run", "test:arch"],
          command: npmCommand,
          step: "test-arch"
        }
      ];
    case "full":
      return [
        {
          args: ["run", "test"],
          command: npmCommand,
          step: "test"
        }
      ];
    case "related":
      return [
        {
          args: ["exec", "vitest", "--", "related", "--run", ...(pool === undefined ? [] : ["--pool", pool]), ...plan.testCommand.targets],
          command: npmCommand,
          step: "test-related"
        }
      ];
    case "none":
      return [];
  }
}
