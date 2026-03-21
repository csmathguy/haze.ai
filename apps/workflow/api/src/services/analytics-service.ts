import type { PrismaClient } from "@taxes/db";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface StepMetrics {
  stepId: string;
  stepType: string;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  successRate: number; // 0-1
  medianDurationMs: number;
  p95DurationMs: number;
  avgRetryCount: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

export interface DefinitionMetrics {
  definitionName: string;
  totalRuns: number;
  successRate: number;
  healthScore: number; // 0-100
  steps: StepMetrics[];
}

export interface GetAnalyticsOptions {
  definitionName?: string;
  since?: Date;
}

function computeMedian(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return ((sortedValues[mid - 1] ?? 0) + (sortedValues[mid] ?? 0)) / 2;
  }
  return sortedValues[mid] ?? 0;
}

function computeP95(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((sortedValues.length * 95) / 100) - 1;
  return sortedValues[Math.max(0, index)] ?? 0;
}

function parseTokenUsage(tokenUsageJson: string | null | undefined): TokenUsage {
  if (!tokenUsageJson) return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  try {
    const parsed = JSON.parse(tokenUsageJson) as Record<string, number> | null;
    if (parsed && typeof parsed === "object") {
      return { inputTokens: parsed.inputTokens ?? 0, outputTokens: parsed.outputTokens ?? 0, totalTokens: parsed.totalTokens ?? 0 };
    }
  } catch { /* ignore */ }
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function computeHealthScore(successRate: number): number {
  if (successRate >= 0.9) return 100;
  if (successRate >= 0.8) return 85;
  if (successRate >= 0.7) return 70;
  return Math.round(successRate * 100);
}

interface StepRunRecord {
  stepId: string;
  stepType: string;
  errorJson: string | null;
  completedAt: string | null;
  startedAt: string;
  retryCount: number;
  tokenUsageJson?: string | null;
  run: { definitionName: string };
}

function computeStepMetrics(stepId: string, stepType: string, stepRuns: StepRunRecord[]): StepMetrics {
  const totalRuns = stepRuns.length;
  const successCount = stepRuns.filter((r) => !r.errorJson).length;
  const failureCount = stepRuns.filter((r) => r.errorJson).length;
  const successRate = totalRuns > 0 ? successCount / totalRuns : 0;

  const durations = stepRuns
    .filter((r): r is StepRunRecord & { completedAt: string } => r.completedAt !== null)
    .map((r) => new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime())
    .sort((a, b) => a - b);

  const avgRetryCount = totalRuns > 0 ? stepRuns.reduce((sum, r) => sum + r.retryCount, 0) / totalRuns : 0;
  const tokenUsages = stepRuns.map((r) => parseTokenUsage(r.tokenUsageJson));
  const avgInputTokens = totalRuns > 0 ? tokenUsages.reduce((sum, t) => sum + t.inputTokens, 0) / totalRuns : 0;
  const avgOutputTokens = totalRuns > 0 ? tokenUsages.reduce((sum, t) => sum + t.outputTokens, 0) / totalRuns : 0;

  return { stepId, stepType, totalRuns, successCount, failureCount, successRate, medianDurationMs: computeMedian(durations), p95DurationMs: computeP95(durations), avgRetryCount, avgInputTokens, avgOutputTokens };
}

function computeDefinitionMetrics(definitionName: string, runs: StepRunRecord[]): DefinitionMetrics {
  const stepMap = new Map<string, { stepId: string; stepType: string; runs: StepRunRecord[] }>();
  for (const stepRun of runs) {
    const key = stepRun.stepId;
    const entry = stepMap.get(key) ?? { stepId: stepRun.stepId, stepType: stepRun.stepType, runs: [] };
    entry.runs.push(stepRun);
    stepMap.set(key, entry);
  }

  let totalSuccesses = 0;
  const steps: StepMetrics[] = [];
  for (const [, stepData] of stepMap) {
    const metrics = computeStepMetrics(stepData.stepId, stepData.stepType, stepData.runs);
    steps.push(metrics);
    totalSuccesses += metrics.successCount;
  }

  const totalRuns = runs.length;
  const successRate = totalRuns > 0 ? totalSuccesses / totalRuns : 0;
  return { definitionName, totalRuns, successRate, healthScore: computeHealthScore(successRate), steps };
}

/**
 * Get workflow analytics for one or all workflow definitions
 */
export async function getWorkflowAnalytics(
  db: PrismaClient,
  options: GetAnalyticsOptions = {}
): Promise<DefinitionMetrics[]> {
  const since = options.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = { startedAt: { gte: since } };
  if (options.definitionName) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    whereClause.run = { definitionName: options.definitionName };
  }

  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
  const stepRuns: StepRunRecord[] = await (db as any).workflowStepRun.findMany({
    where: whereClause,
    include: { run: true }
  });
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

  const definitionMap = new Map<string, StepRunRecord[]>();
  for (const stepRun of stepRuns) {
    const defName = stepRun.run.definitionName;
    const entry = definitionMap.get(defName) ?? [];
    entry.push(stepRun);
    definitionMap.set(defName, entry);
  }

  return Array.from(definitionMap.entries())
    .map(([name, runs]) => computeDefinitionMetrics(name, runs))
    .sort((a, b) => a.definitionName.localeCompare(b.definitionName));
}
