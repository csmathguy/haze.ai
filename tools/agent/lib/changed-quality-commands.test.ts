import { describe, expect, it } from "vitest";

import { buildChangedQualityCommands } from "./changed-quality-commands.js";

const npmCommand = {
  command: "npm",
  prefixArgs: []
};

describe("buildChangedQualityCommands", () => {
  it("runs lint-only preflight before related tests without duplicate typecheck steps", () => {
    const commands = buildChangedQualityCommands(["apps/code-review/web/src/app/api.ts"], npmCommand, "forks");

    expect(commands.map((command) => command.step)).toEqual(["lint-preflight", "test-related"]);
    expect(commands[0]?.args).toEqual(["run", "quality:lint-only", "--", "apps/code-review/web/src/app/api.ts"]);
    expect(commands[1]?.args).toEqual([
      "exec",
      "vitest",
      "--",
      "related",
      "--run",
      "--pool",
      "forks",
      "apps/code-review/web/src/app/api.ts"
    ]);
  });

  it("keeps stylelint after the lint-only preflight for stylesheet changes", () => {
    const commands = buildChangedQualityCommands(["apps/code-review/web/src/app/index.css"], npmCommand);

    expect(commands.map((command) => command.step)).toEqual(["lint-preflight", "stylelint-changed"]);
    expect(commands[1]?.args).toEqual([
      "exec",
      "stylelint",
      "--",
      "--allow-empty-input",
      "apps/code-review/web/src/app/index.css"
    ]);
  });

  it("runs only architecture tests when the change is architecture-only", () => {
    const commands = buildChangedQualityCommands(["tools/quality/architecture/architecture.spec.ts"], npmCommand);

    expect(commands.map((command) => command.step)).toEqual(["lint-preflight", "test-arch"]);
  });
});
