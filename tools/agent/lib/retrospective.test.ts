import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AuditEvent, AuditSummary } from "./audit.js";
import { buildRetrospectiveMarkdown, createRetrospectiveArtifact, resolveRetrospectivePaths } from "./retrospective.js";

const temporaryDirectories: string[] = [];

describe("resolveRetrospectivePaths", () => {
  it("derives the audit and retrospective locations from the run id", () => {
    const paths = resolveRetrospectivePaths("2026-03-11T180205-485-implementation-5cc22a65", {
      auditRoot: "audit-root",
      retrospectiveRoot: "retro-root"
    });

    expect(paths.runDir).toBe(path.join("audit-root", "2026-03-11", "2026-03-11T180205-485-implementation-5cc22a65"));
    expect(paths.outputPath).toBe(
      path.join("retro-root", "2026-03-11", "2026-03-11T180205-485-implementation-5cc22a65.md")
    );
  });
});

describe("buildRetrospectiveMarkdown", () => {
  it("renders evidence and improvement prompts from the audit run", () => {
    const summary = createSummary();
    const markdown = buildRetrospectiveMarkdown(
      {
        events: createEvents(summary.runId),
        paths: {
          eventsPath: path.join("artifacts", "audit", "2026-03-11", summary.runId, "events.ndjson"),
          outputPath: path.join("artifacts", "retrospectives", "2026-03-11", `${summary.runId}.md`),
          runDir: path.join("artifacts", "audit", "2026-03-11", summary.runId),
          summaryPath: path.join("artifacts", "audit", "2026-03-11", summary.runId, "summary.json")
        },
        summary
      },
      new Date("2026-03-12T00:00:00.000Z")
    );

    expect(markdown).toContain("## Evidence Snapshot");
    expect(markdown).toContain("lint (22s; log: `logs/lint.log`)");
    expect(markdown).toContain("lint x2 (1 failed, recovered later)");
    expect(markdown).toContain("Workflow note: quality-gates failed.");
    expect(markdown).toContain("## Tooling, Systems, And Structure Improvements");
    expect(markdown).toContain("| Action | Owner | Due date | Evidence |");
  });
});

describe("createRetrospectiveArtifact", () => {
  it("writes a retrospective file under the requested output root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "retrospective-"));
    temporaryDirectories.push(root);

    const summary = createSummary();
    const runDir = path.join(root, "audit", "2026-03-11", summary.runId);
    const outputRoot = path.join(root, "retrospectives");

    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(
      path.join(runDir, "events.ndjson"),
      `${createEvents(summary.runId)
        .map((event) => JSON.stringify(event))
        .join("\n")}\n`
    );

    const run = await createRetrospectiveArtifact(summary.runId, {
      auditRoot: path.join(root, "audit"),
      now: new Date("2026-03-12T00:00:00.000Z"),
      retrospectiveRoot: outputRoot
    });

    const contents = await readFile(run.paths.outputPath, "utf8");

    expect(run.paths.outputPath).toBe(path.join(outputRoot, "2026-03-11", `${summary.runId}.md`));
    expect(contents).toContain("# Workflow Retrospective");
    expect(contents).toContain("## Future Tasks To Consider");
  });
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

function createSummary(): AuditSummary {
  return {
    actor: "csmat",
    completedAt: "2026-03-11T23:48:31.953Z",
    cwd: "C:\\Users\\csmat\\source\\repos\\Taxes",
    durationMs: 6386464,
    runId: "2026-03-11T180205-485-implementation-5cc22a65",
    startedAt: "2026-03-11T22:02:05.489Z",
    status: "success",
    steps: [
      {
        command: ["npm", "run", "lint"],
        durationMs: 22000,
        exitCode: 1,
        logFile: "C:\\Users\\csmat\\source\\repos\\Taxes\\artifacts\\audit\\2026-03-11\\2026-03-11T180205-485-implementation-5cc22a65\\logs\\lint.log",
        startedAt: "2026-03-11T22:27:14.982Z",
        status: "failed",
        step: "lint"
      },
      {
        command: ["npm", "run", "lint"],
        durationMs: 34000,
        exitCode: 0,
        logFile: "C:\\Users\\csmat\\source\\repos\\Taxes\\artifacts\\audit\\2026-03-11\\2026-03-11T180205-485-implementation-5cc22a65\\logs\\lint.log",
        startedAt: "2026-03-11T22:33:14.669Z",
        status: "success",
        step: "lint"
      },
      {
        command: ["npm", "run", "test:coverage"],
        durationMs: 107646,
        exitCode: 1,
        logFile: "C:\\Users\\csmat\\source\\repos\\Taxes\\artifacts\\audit\\2026-03-11\\2026-03-11T180205-485-implementation-5cc22a65\\logs\\test-coverage.log",
        startedAt: "2026-03-11T22:33:51.413Z",
        status: "failed",
        step: "test-coverage"
      }
    ],
    task: "build extraction and questionnaire foundation",
    workflow: "implementation"
  };
}

function createEvents(runId: string): AuditEvent[] {
  return [
    {
      actor: "csmat",
      cwd: "C:\\Users\\csmat\\source\\repos\\Taxes",
      eventId: "start",
      eventType: "workflow-start",
      runId,
      status: "running",
      task: "build extraction and questionnaire foundation",
      timestamp: "2026-03-11T22:02:05.492Z",
      workflow: "implementation"
    },
    {
      actor: "csmat",
      command: ["npm", "run", "lint"],
      cwd: "C:\\Users\\csmat\\source\\repos\\Taxes",
      durationMs: 22000,
      eventId: "lint-failed",
      eventType: "command-end",
      exitCode: 1,
      logFile: "C:\\Users\\csmat\\source\\repos\\Taxes\\artifacts\\audit\\2026-03-11\\2026-03-11T180205-485-implementation-5cc22a65\\logs\\lint.log",
      runId,
      status: "failed",
      step: "lint",
      timestamp: "2026-03-11T22:27:41.413Z",
      workflow: "implementation"
    },
    {
      actor: "csmat",
      cwd: "C:\\Users\\csmat\\source\\repos\\Taxes",
      eventId: "note",
      eventType: "workflow-note",
      metadata: {
        message: "quality-gates failed"
      },
      runId,
      status: "failed",
      timestamp: "2026-03-11T22:27:41.416Z",
      workflow: "implementation"
    },
    {
      actor: "csmat",
      cwd: "C:\\Users\\csmat\\source\\repos\\Taxes",
      eventId: "end",
      eventType: "workflow-end",
      runId,
      status: "success",
      timestamp: "2026-03-11T23:48:31.956Z",
      workflow: "implementation"
    }
  ];
}
