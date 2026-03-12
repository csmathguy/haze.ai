import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearActiveExecution,
  clearActiveRun,
  createWorkflowSummary,
  ensureAuditPaths,
  getActiveExecution,
  setActiveRun,
  writeSummary
} from "./audit.js";
import { endExecution, startExecution } from "./execution.js";

describe("execution lifecycle", () => {
  const cwd = process.cwd();
  const workflow = "execution-test";

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    await clearActiveExecution(workflow, "exec-123");
    await clearActiveRun(workflow);
  });

  afterEach(async () => {
    await clearActiveRun(workflow);
  });

  it("persists active executions until they finish", async () => {
    const runId = "2026-03-11T120000-000-execution-test-deadbeef";
    const paths = await ensureAuditPaths(runId);
    const summary = createWorkflowSummary(runId, workflow);

    await writeSummary(paths, summary);
    await setActiveRun(workflow, runId);

    const started = await startExecution(
      {
        paths,
        runId,
        summary,
        workflow
      },
      {
        kind: "skill",
        metadata: {
          source: "skill"
        },
        name: "workflow-audit"
      }
    );

    const activeBeforeEnd = await getActiveExecution(workflow, started.executionId);
    expect(activeBeforeEnd?.executionId).toBe(started.executionId);

    await endExecution(
      {
        paths,
        runId,
        summary,
        workflow
      },
      started,
      {
        metadata: {
          outcome: "logged"
        },
        status: "success"
      }
    );

    const activeAfterEnd = await getActiveExecution(workflow, started.executionId);
    expect(activeAfterEnd).toBeNull();
    expect(summary.executions[0]?.kind).toBe("skill");
    expect(summary.stats.byKind.skill).toBe(1);
  });
});
