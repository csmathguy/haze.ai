import { describe, expect, it } from "vitest";

import type { AuditSummary } from "./audit.js";
import { buildPullRequestDraft } from "./pull-request-draft.js";
import {
  buildPullRequestBody,
  collectValidationCommands,
  collectValidationCommandsFromSummaries,
  getCompletionRequirements
} from "./pull-request-publish.js";

describe("buildPullRequestBody", () => {
  it("combines the generated draft sections with supplied summary and validation commands", () => {
    const draft = buildPullRequestDraft([
      "tools/agent/pull-request-draft.ts",
      "docs/pull-request-standards.md"
    ]);

    const body = buildPullRequestBody({
      draft,
      privacyConfirmed: true,
      summary: "Standardize the final publication step for agent-completed work.",
      validationCommands: [
        "node tools/runtime/run-npm.cjs run quality:changed -- tools/agent/pull-request-sync.ts",
        "node tools/runtime/run-npm.cjs run pr:draft -- --staged"
      ],
      value: "Make PR creation part of the default completion path instead of an extra manual request."
    });

    expect(body).toContain("## Summary");
    expect(body).toContain("Standardize the final publication step for agent-completed work.");
    expect(body).toContain("Make PR creation part of the default completion path instead of an extra manual request.");
    expect(body).toContain("## What Changed");
    expect(body).toContain("### Tooling and automation");
    expect(body).toContain("### Documentation and contributor workflow");
    expect(body).toContain("## Validation");
    expect(body).toContain("[x] `node tools/runtime/run-npm.cjs run quality:changed -- tools/agent/pull-request-sync.ts`");
    expect(body).toContain("Commands run:");
    expect(body).toContain("## Privacy");
    expect(body).toContain("[x] No private tax documents, extracted data, or generated filings were added to the repository");
  });
});

describe("collectValidationCommands", () => {
  it("deduplicates recorded audit commands while preserving order", () => {
    const summary = {
      steps: [
        {
          command: ["node", "tools/runtime/run-npm.cjs", "run", "quality:changed", "--", "package.json"],
          durationMs: 1,
          exitCode: 0,
          logFile: "logs/quality.log",
          startedAt: "2026-03-11T20:00:00.000Z",
          status: "success",
          step: "quality-changed"
        },
        {
          command: ["node", "tools/runtime/run-npm.cjs", "run", "quality:changed", "--", "package.json"],
          durationMs: 2,
          exitCode: 0,
          logFile: "logs/quality-second.log",
          startedAt: "2026-03-11T20:01:00.000Z",
          status: "success",
          step: "quality-changed-duplicate"
        },
        {
          command: ["node", "tools/runtime/run-npm.cjs", "run", "pr:draft", "--", "--staged"],
          durationMs: 1,
          exitCode: 0,
          logFile: "logs/pr-draft.log",
          startedAt: "2026-03-11T20:02:00.000Z",
          status: "success",
          step: "pr-draft"
        }
      ]
    } satisfies Pick<AuditSummary, "steps">;

    expect(collectValidationCommands(summary)).toEqual([
      "node tools/runtime/run-npm.cjs run quality:changed -- package.json",
      "node tools/runtime/run-npm.cjs run pr:draft -- --staged"
    ]);
  });

  it("normalizes node-plus-npm-cli audit commands into stable npm invocations", () => {
    const summary = {
      steps: [
        {
          command: [
            "C:\\Users\\csmat\\AppData\\Local\\nvm\\v24.14.0\\node.exe",
            "C:\\Users\\csmat\\AppData\\Local\\nvm\\v24.14.0\\node_modules\\npm\\bin\\npm-cli.js",
            "run",
            "typecheck"
          ],
          durationMs: 1,
          exitCode: 0,
          logFile: "logs/typecheck.log",
          startedAt: "2026-03-11T20:00:00.000Z",
          status: "success",
          step: "typecheck"
        },
        {
          command: [
            "C:\\Program Files\\nodejs\\node.exe",
            "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
            "run",
            "typecheck"
          ],
          durationMs: 1,
          exitCode: 0,
          logFile: "logs/typecheck-second.log",
          startedAt: "2026-03-11T20:01:00.000Z",
          status: "success",
          step: "typecheck-duplicate"
        },
        {
          command: [
            "C:\\Users\\csmat\\AppData\\Local\\nvm\\v24.14.0\\node.exe",
            "C:\\Users\\csmat\\AppData\\Local\\nvm\\v24.14.0\\node_modules\\npm\\bin\\npm-cli.js",
            "exec",
            "eslint",
            "--",
            "--max-warnings=0",
            "tools/agent/pull-request-sync.ts"
          ],
          durationMs: 1,
          exitCode: 0,
          logFile: "logs/eslint.log",
          startedAt: "2026-03-11T20:02:00.000Z",
          status: "success",
          step: "eslint"
        }
      ]
    } satisfies Pick<AuditSummary, "steps">;

    expect(collectValidationCommands(summary)).toEqual([
      "npm run typecheck",
      "npm exec eslint -- --max-warnings=0 tools/agent/pull-request-sync.ts"
    ]);
  });
});

describe("collectValidationCommandsFromSummaries", () => {
  it("merges commands from multiple workflow summaries without duplicates", () => {
    const summaries = [
      {
        steps: [
          {
            command: ["node", "tools/runtime/run-npm.cjs", "run", "quality:changed", "--", "package.json"],
            durationMs: 1,
            exitCode: 0,
            logFile: "logs/quality.log",
            startedAt: "2026-03-11T20:00:00.000Z",
            status: "success",
            step: "quality-changed"
          }
        ]
      },
      {
        steps: [
          {
            command: ["node", "tools/runtime/run-npm.cjs", "run", "quality:logged", "--", "pre-push"],
            durationMs: 1,
            exitCode: 0,
            logFile: "logs/pre-push.log",
            startedAt: "2026-03-11T20:01:00.000Z",
            status: "success",
            step: "quality-logged"
          },
          {
            command: ["node", "tools/runtime/run-npm.cjs", "run", "quality:changed", "--", "package.json"],
            durationMs: 1,
            exitCode: 0,
            logFile: "logs/quality-duplicate.log",
            startedAt: "2026-03-11T20:02:00.000Z",
            status: "success",
            step: "quality-changed-duplicate"
          }
        ]
      }
    ] satisfies Pick<AuditSummary, "steps">[];

    expect(collectValidationCommandsFromSummaries(summaries)).toEqual([
      "node tools/runtime/run-npm.cjs run quality:changed -- package.json",
      "node tools/runtime/run-npm.cjs run quality:logged -- pre-push"
    ]);
  });
});

describe("getCompletionRequirements", () => {
  it("requires both a clean worktree and an open pull request for successful implementation work with commits", () => {
    expect(
      getCompletionRequirements({
        commitsAhead: 2,
        status: "success",
        workflow: "implementation",
        worktreeDirty: true
      })
    ).toEqual({
      requiresCleanWorktree: true,
      requiresPullRequest: true
    });
  });

  it("does not require a pull request when there are no commits to publish", () => {
    expect(
      getCompletionRequirements({
        commitsAhead: 0,
        status: "success",
        workflow: "implementation",
        worktreeDirty: false
      })
    ).toEqual({
      requiresCleanWorktree: true,
      requiresPullRequest: false
    });
  });

  it("does not enforce publication gates for non-success or non-implementation workflows", () => {
    expect(
      getCompletionRequirements({
        commitsAhead: 4,
        status: "failed",
        workflow: "implementation",
        worktreeDirty: true
      })
    ).toEqual({
      requiresCleanWorktree: false,
      requiresPullRequest: false
    });

    expect(
      getCompletionRequirements({
        commitsAhead: 4,
        status: "success",
        workflow: "pre-push",
        worktreeDirty: true
      })
    ).toEqual({
      requiresCleanWorktree: false,
      requiresPullRequest: false
    });
  });
});
