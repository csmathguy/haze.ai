import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AuditFailureInsight } from "@taxes/shared";
import type { AuditEvent, AuditSummary } from "../../../../../tools/agent/lib/audit.js";
import type { TestAuditContext } from "../test/database.js";
import { createTestAuditContext } from "../test/database.js";
import { getAuditRunDetail, syncAuditEvent, syncAuditSummary } from "./audit-store.js";

describe("audit failure insights", () => {
  const contexts: TestAuditContext[] = [];

  afterEach(async () => {
    await Promise.all(contexts.splice(0, contexts.length).map(async (context) => context.cleanup()));
  });

  it("includes execution errors and local log excerpts in run detail", async () => {
    const context = await createTestAuditContext("audit-failure-insights");
    contexts.push(context);
    const seeded = await seedFailedRun(context);

    await syncAuditEvent(seeded.event, {
      databaseUrl: context.databaseUrl
    });
    await syncAuditSummary(seeded.summary, {
      databaseUrl: context.databaseUrl
    });

    const detail = await getAuditRunDetail(seeded.runId, {
      databaseUrl: context.databaseUrl
    });

    assertFailureInsight(detail?.failureInsights, seeded.logFile);
  });
});

async function seedFailedRun(context: TestAuditContext) {
  const runId = "2026-03-13T000000-000-pre-commit-deadbeef";
  const runDirectory = path.join(context.rootDirectory, "artifacts", "audit", "2026-03-13", runId);
  const logFile = path.join(runDirectory, "logs", "validate-changed-files.log");

  await writeFailureLog(logFile);

  return {
    event: buildFailureEvent(context.rootDirectory, logFile, runId),
    logFile,
    runId,
    summary: buildFailureSummary(context.rootDirectory, logFile, runId)
  };
}

function buildFailureSummary(rootDirectory: string, logFile: string, runId: string): AuditSummary {
  return {
    actor: "codex",
    artifacts: [],
    completedAt: "2026-03-13T00:00:04.000Z",
    cwd: rootDirectory,
    decisions: [],
    durationMs: 4000,
    executions: [
      {
        command: ["npm", "run", "quality:changed"],
        durationMs: 3000,
        errorMessage: "Command failed with exit code 1",
        executionId: "exec-1",
        exitCode: 1,
        kind: "command",
        logFile,
        name: "Validate changed files",
        startedAt: "2026-03-13T00:00:01.000Z",
        status: "failed",
        step: "validate-changed-files"
      }
    ],
    failures: [
      {
        category: "validation",
        detail: "TypeScript rejected a changed file in the planning UI.",
        executionId: "exec-1",
        failureId: "failure-1",
        retryable: true,
        severity: "medium",
        status: "open",
        summary: "Changed-file validation failed",
        timestamp: "2026-03-13T00:00:04.000Z"
      }
    ],
    handoffs: [],
    runId,
    startedAt: "2026-03-13T00:00:00.000Z",
    stats: {
      byKind: {
        command: 1
      },
      byStatus: {
        failed: 1
      },
      executionCount: 1,
      failedExecutionCount: 1
    },
    status: "failed",
    steps: [
      {
        command: ["npm", "run", "quality:changed"],
        durationMs: 3000,
        exitCode: 1,
        logFile,
        startedAt: "2026-03-13T00:00:01.000Z",
        status: "failed",
        step: "validate-changed-files"
      }
    ],
    task: "Validate changed files: apps/plan/web/src/app/App.tsx",
    workflow: "pre-commit"
  };
}

function buildFailureEvent(rootDirectory: string, logFile: string, runId: string): AuditEvent {
  return {
    actor: "codex",
    cwd: rootDirectory,
    errorMessage: "Command failed with exit code 1",
    eventId: "event-1",
    eventType: "execution-end",
    executionId: "exec-1",
    executionKind: "command",
    executionName: "Validate changed files",
    exitCode: 1,
    logFile,
    runId,
    status: "failed",
    step: "validate-changed-files",
    timestamp: "2026-03-13T00:00:04.000Z",
    workflow: "pre-commit"
  };
}

async function writeFailureLog(logFile: string): Promise<void> {
  await mkdir(path.dirname(logFile), { recursive: true });
  await writeFile(
    logFile,
    [
      "> taxes@0.1.0 quality:changed",
      "error TS2322: Type 'string' is not assignable to type 'number'.",
      "apps/plan/web/src/app/App.tsx:18:7",
      "1 problem found"
    ].join("\n")
  );
}

function assertFailureInsight(failureInsights: AuditFailureInsight[] | undefined, logFile: string): void {
  expect(failureInsights).toHaveLength(1);
  const firstInsight = failureInsights?.[0];

  expect(firstInsight).toBeDefined();
  expect(firstInsight?.detail).toBe("TypeScript rejected a changed file in the planning UI.");
  expect(firstInsight?.errorMessage).toBe("Command failed with exit code 1");
  expect(firstInsight?.executionId).toBe("exec-1");
  expect(firstInsight?.executionName).toBe("Validate changed files");
  expect(firstInsight?.logExcerpt).toContain("Type 'string' is not assignable to type 'number'.");
  expect(firstInsight?.logFile).toBe(logFile);
  expect(firstInsight?.sourceType).toBe("failure");
  expect(firstInsight?.summary).toBe("Changed-file validation failed");
}
