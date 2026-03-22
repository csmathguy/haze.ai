/**
 * workflow:token-report
 *
 * Summarizes token usage across workflow runs by reading the tokenUsageJson
 * column on WorkflowStepRun records. Helps identify which agent steps are
 * consuming the most tokens so cost optimizations can be targeted.
 *
 * Usage:
 *   npm run workflow:token-report
 *   npm run workflow:token-report -- --limit 20
 *   npm run workflow:token-report -- --run <runId>
 *   npm run workflow:token-report -- --by-work-item
 *   npm run workflow:token-report -- --by-work-item --limit 20
 */

import Database from "better-sqlite3";
import * as path from "node:path";
import * as os from "node:os";

const DEFAULT_DB_PATH = path.join(
  process.env.USERPROFILE ?? os.homedir(),
  "AppData", "Local", "haze-ai", "workflow.db"
);
const WORKFLOW_DB_PATH = process.env.WORKFLOW_DATABASE_URL?.replace(/^file:/, "") ?? DEFAULT_DB_PATH;

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface StepRow {
  runId: string;
  stepId: string;
  tokenUsageJson: string | null;
}

interface RunRow {
  id: string;
  workItemId: string | null;
}

interface StepSummary {
  inputTokens: number;
  outputTokens: number;
  stepId: string;
  totalTokens: number;
}

interface RunSummary {
  inputTokens: number;
  outputTokens: number;
  runId: string;
  steps: StepSummary[];
  totalTokens: number;
}

interface WorkItemSummary {
  inputTokens: number;
  outputTokens: number;
  runCount: number;
  totalTokens: number;
  workItemId: string;
}

interface ParsedArgs {
  byWorkItem: boolean;
  limit: number;
  runId?: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let limit = 10;
  let runId: string | undefined;
  let byWorkItem = false;

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    switch (token) {
      case "--limit":
        if (args[i + 1] !== undefined) {
          limit = parseInt(args[i + 1] ?? "10", 10);
          i++;
        }
        break;
      case "--run":
        if (args[i + 1] !== undefined) {
          runId = args[i + 1];
          i++;
        }
        break;
      case "--by-work-item":
        byWorkItem = true;
        break;
      case undefined:
      default:
        break;
    }
  }

  const result: ParsedArgs = { byWorkItem, limit };
  if (runId !== undefined) result.runId = runId;
  return result;
}

function parseTokenUsage(json: string | null): TokenUsage {
  if (json === null) return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  try {
    const parsed = JSON.parse(json) as Partial<TokenUsage>;
    return {
      inputTokens: parsed.inputTokens ?? 0,
      outputTokens: parsed.outputTokens ?? 0,
      totalTokens: parsed.totalTokens ?? 0
    };
  } catch {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function bar(value: number, max: number, width = 12): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function openDb(dbPath: string): Database.Database {
  return new Database(dbPath, { readonly: true });
}

function queryStepRuns(dbPath: string, runId: string | undefined, limit: number): StepRow[] {
  const db = openDb(dbPath);
  try {
    const sql = runId !== undefined
      ? `SELECT runId, stepId, tokenUsageJson FROM WorkflowStepRun WHERE runId = ? ORDER BY completedAt DESC LIMIT ?`
      : `SELECT runId, stepId, tokenUsageJson FROM WorkflowStepRun ORDER BY completedAt DESC LIMIT ?`;
    const params: (string | number)[] = runId !== undefined ? [runId, limit * 20] : [limit * 20];
    return db.prepare(sql).all(...params) as StepRow[];
  } finally {
    db.close();
  }
}

function queryRunWorkItems(dbPath: string, runIds: string[]): Map<string, string | null> {
  const db = openDb(dbPath);
  try {
    const placeholders = runIds.map(() => "?").join(",");
    const rows = db.prepare(
      `SELECT id, workItemId FROM WorkflowRun WHERE id IN (${placeholders})`
    ).all(...runIds) as RunRow[];
    return new Map(rows.map((r) => [r.id, r.workItemId]));
  } finally {
    db.close();
  }
}

function aggregateByRun(stepRuns: StepRow[], limit: number): RunSummary[] {
  const runMap = new Map<string, RunSummary>();

  for (const step of stepRuns) {
    const usage = parseTokenUsage(step.tokenUsageJson);
    if (usage.totalTokens === 0) continue;

    const existing = runMap.get(step.runId) ?? {
      inputTokens: 0,
      outputTokens: 0,
      runId: step.runId,
      steps: [],
      totalTokens: 0
    };

    existing.inputTokens += usage.inputTokens;
    existing.outputTokens += usage.outputTokens;
    existing.totalTokens += usage.totalTokens;
    existing.steps.push({
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      stepId: step.stepId,
      totalTokens: usage.totalTokens
    });

    runMap.set(step.runId, existing);
  }

  return [...runMap.values()]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, limit);
}

function aggregateByWorkItem(dbPath: string, limit: number): WorkItemSummary[] {
  const db = openDb(dbPath);
  let runs: RunRow[];
  try {
    runs = db.prepare(
      `SELECT id, workItemId FROM WorkflowRun WHERE workItemId IS NOT NULL`
    ).all() as RunRow[];
  } finally {
    db.close();
  }

  if (runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const db2 = openDb(dbPath);
  let stepRows: StepRow[];
  try {
    const placeholders = runIds.map(() => "?").join(",");
    stepRows = db2.prepare(
      `SELECT runId, stepId, tokenUsageJson FROM WorkflowStepRun WHERE runId IN (${placeholders})`
    ).all(...runIds) as StepRow[];
  } finally {
    db2.close();
  }

  const runIdToWorkItem = new Map(runs.map((r) => [r.id, r.workItemId ?? "unknown"]));
  const itemMap = new Map<string, WorkItemSummary>();

  for (const step of stepRows) {
    const usage = parseTokenUsage(step.tokenUsageJson);
    if (usage.totalTokens === 0) continue;

    const workItemId = runIdToWorkItem.get(step.runId) ?? "unknown";
    const existing = itemMap.get(workItemId) ?? {
      inputTokens: 0,
      outputTokens: 0,
      runCount: 0,
      totalTokens: 0,
      workItemId
    };

    existing.inputTokens += usage.inputTokens;
    existing.outputTokens += usage.outputTokens;
    existing.totalTokens += usage.totalTokens;
    itemMap.set(workItemId, existing);
  }

  for (const run of runs) {
    const workItemId = run.workItemId ?? "unknown";
    const existing = itemMap.get(workItemId);
    if (existing !== undefined) {
      existing.runCount++;
    }
  }

  return [...itemMap.values()]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, limit);
}

function printByRunReport(runs: RunSummary[], workItemMap: Map<string, string | null>): void {
  if (runs.length === 0) {
    process.stdout.write("No token usage data recorded yet. Run some workflows first.\n");
    return;
  }

  const grandTotal = runs.reduce((sum, r) => sum + r.totalTokens, 0);

  process.stdout.write(`\n[workflow:token-report] Top ${String(runs.length)} runs by token usage\n\n`);
  process.stdout.write(`${"Run ID".padEnd(36)} ${"Work Item".padEnd(12)} ${"Total".padStart(8)}  ${"In".padStart(8)}  ${"Out".padStart(8)}\n`);
  process.stdout.write(`${"-".repeat(36)} ${"-".repeat(12)} ${"-".repeat(8)}  ${"-".repeat(8)}  ${"-".repeat(8)}\n`);

  for (const run of runs) {
    const workItem = workItemMap.get(run.runId) ?? null;
    const workItemLabel = workItem ?? "-";
    process.stdout.write(
      `${run.runId.slice(0, 34).padEnd(36)} ${workItemLabel.padEnd(12)} ${formatNumber(run.totalTokens).padStart(8)}  ` +
      `${formatNumber(run.inputTokens).padStart(8)}  ${formatNumber(run.outputTokens).padStart(8)}\n`
    );

    const maxStepTokens = run.steps[0]?.totalTokens ?? 0;
    const topSteps = run.steps.toSorted((a, b) => b.totalTokens - a.totalTokens).slice(0, 3);
    for (const step of topSteps) {
      process.stdout.write(
        `  ${bar(step.totalTokens, maxStepTokens)} ${step.stepId.padEnd(35)} ${formatNumber(step.totalTokens).padStart(8)}\n`
      );
    }
  }

  process.stdout.write(`\n${"Grand total (shown runs):".padEnd(52)} ${formatNumber(grandTotal).padStart(8)}\n\n`);
}

function printByWorkItemReport(items: WorkItemSummary[]): void {
  if (items.length === 0) {
    process.stdout.write(
      "No token usage data linked to work items yet.\n" +
      "Pass workItemId when creating a workflow run to link it to a PLAN item.\n"
    );
    return;
  }

  const grandTotal = items.reduce((sum, i) => sum + i.totalTokens, 0);
  const maxTokens = items[0]?.totalTokens ?? 0;

  process.stdout.write(`\n[workflow:token-report] Token usage by work item\n\n`);
  process.stdout.write(`${"Work Item".padEnd(14)} ${"Runs".padStart(4)}  ${"Total".padStart(8)}  ${"In".padStart(8)}  ${"Out".padStart(8)}  Chart\n`);
  process.stdout.write(`${"-".repeat(14)} ${"-".repeat(4)}  ${"-".repeat(8)}  ${"-".repeat(8)}  ${"-".repeat(8)}  ${"-".repeat(12)}\n`);

  for (const item of items) {
    process.stdout.write(
      `${item.workItemId.padEnd(14)} ${String(item.runCount).padStart(4)}  ` +
      `${formatNumber(item.totalTokens).padStart(8)}  ` +
      `${formatNumber(item.inputTokens).padStart(8)}  ` +
      `${formatNumber(item.outputTokens).padStart(8)}  ` +
      `${bar(item.totalTokens, maxTokens)}\n`
    );
  }

  process.stdout.write(`\n${"Grand total (shown items):".padEnd(24)} ${formatNumber(grandTotal).padStart(8)}\n\n`);
}

function main(): void {
  const { byWorkItem, limit, runId } = parseArgs();

  if (byWorkItem) {
    const items = aggregateByWorkItem(WORKFLOW_DB_PATH, limit);
    printByWorkItemReport(items);
    return;
  }

  const stepRuns = queryStepRuns(WORKFLOW_DB_PATH, runId, limit);
  const runs = aggregateByRun(stepRuns, limit);

  const runIds = runs.map((r) => r.runId);
  const workItemMap = runIds.length > 0
    ? queryRunWorkItems(WORKFLOW_DB_PATH, runIds)
    : new Map<string, string | null>();

  printByRunReport(runs, workItemMap);
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
