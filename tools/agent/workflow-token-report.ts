/**
 * workflow:token-report
 *
 * Summarizes token usage across workflow runs by reading the tokenUsageJson
 * column on StepRun records. Helps identify which agent steps are consuming
 * the most tokens so cost optimizations can be targeted.
 *
 * Usage:
 *   npm run workflow:token-report
 *   npm run workflow:token-report -- --limit 20
 *   npm run workflow:token-report -- --run <runId>
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
  stepName: string;
  tokenUsageJson: string | null;
}

interface StepSummary {
  inputTokens: number;
  outputTokens: number;
  stepName: string;
  totalTokens: number;
}

interface RunSummary {
  inputTokens: number;
  outputTokens: number;
  runId: string;
  steps: StepSummary[];
  totalTokens: number;
}

interface ParsedArgs {
  limit: number;
  runId?: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let limit = 10;
  let runId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1] !== undefined) {
      limit = parseInt(args[i + 1] ?? "10", 10);
      i++;
    } else if (args[i] === "--run" && args[i + 1] !== undefined) {
      runId = args[i + 1];
      i++;
    }
  }

  const result: ParsedArgs = { limit };
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

function queryStepRuns(dbPath: string, runId: string | undefined, limit: number): StepRow[] {
  const db = new Database(dbPath, { readonly: true });

  try {
    const sql = runId !== undefined
      ? `SELECT runId, stepName, tokenUsageJson FROM StepRun WHERE runId = ? ORDER BY completedAt DESC LIMIT ?`
      : `SELECT runId, stepName, tokenUsageJson FROM StepRun ORDER BY completedAt DESC LIMIT ?`;

    const params = runId !== undefined ? [runId, limit * 20] : [limit * 20];
    return db.prepare(sql).all(...params) as StepRow[];
  } finally {
    db.close();
  }
}

function aggregateRuns(stepRuns: StepRow[], limit: number): RunSummary[] {
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
      stepName: step.stepName,
      totalTokens: usage.totalTokens
    });

    runMap.set(step.runId, existing);
  }

  return [...runMap.values()]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, limit);
}

function printReport(runs: RunSummary[]): void {
  if (runs.length === 0) {
    process.stdout.write("No token usage data recorded yet. Run some workflows first.\n");
    return;
  }

  const grandTotal = runs.reduce((sum, r) => sum + r.totalTokens, 0);

  process.stdout.write(`\n[workflow:token-report] Top ${String(runs.length)} runs by token usage\n\n`);
  process.stdout.write(`${"Run ID".padEnd(52)} ${"Total".padStart(8)}  ${"In".padStart(8)}  ${"Out".padStart(8)}\n`);
  process.stdout.write(`${"-".repeat(52)} ${"-".repeat(8)}  ${"-".repeat(8)}  ${"-".repeat(8)}\n`);

  for (const run of runs) {
    const maxStepTokens = run.steps[0]?.totalTokens ?? 0;
    process.stdout.write(
      `${run.runId.slice(0, 50).padEnd(52)} ${formatNumber(run.totalTokens).padStart(8)}  ` +
      `${formatNumber(run.inputTokens).padStart(8)}  ${formatNumber(run.outputTokens).padStart(8)}\n`
    );

    const topSteps = run.steps.toSorted((a, b) => b.totalTokens - a.totalTokens).slice(0, 3);
    for (const step of topSteps) {
      process.stdout.write(
        `  ${bar(step.totalTokens, maxStepTokens)} ${step.stepName.padEnd(35)} ${formatNumber(step.totalTokens).padStart(8)}\n`
      );
    }
  }

  process.stdout.write(`\n${"Grand total (shown runs):".padEnd(52)} ${formatNumber(grandTotal).padStart(8)}\n\n`);
}

function main(): void {
  const { limit, runId } = parseArgs();
  const stepRuns = queryStepRuns(WORKFLOW_DB_PATH, runId, limit);
  printReport(aggregateRuns(stepRuns, limit));
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
