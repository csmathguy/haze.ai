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

/**
 * Compute the median value from a sorted array of numbers
 */
function computeMedian(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    const left = sortedValues[mid - 1];
    const right = sortedValues[mid];
    return ((left ?? 0) + (right ?? 0)) / 2;
  }
  return sortedValues[mid] ?? 0;
}

/**
 * Compute the p95 (95th percentile) value from a sorted array of numbers
 */
function computeP95(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((sortedValues.length * 95) / 100) - 1;
  return sortedValues[Math.max(0, index)] ?? 0;
}

/**
 * Parse token usage JSON with fallback to defaults
 */
function parseTokenUsage(tokenUsageJson: string | null | undefined): TokenUsage {
  if (!tokenUsageJson) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
  try {
    const parsed = JSON.parse(tokenUsageJson) as Record<string, number> | null;
    if (parsed && typeof parsed === "object") {
      return {
        inputTokens: parsed.inputTokens ?? 0,
        outputTokens: parsed.outputTokens ?? 0,
        totalTokens: parsed.totalTokens ?? 0
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function computeStepMetrics(
  stepRuns: ({ errorJson: string | null; completedAt: Date | null; startedAt: Date; retryCount: number } & Record<string, unknown>)[],
  stepData: { stepId: string; stepType: string }
): { metrics: StepMetrics; successCount: number; failureCount: number } {
  const totalRuns = stepRuns.length;
  const successCount = stepRuns.filter((r) => !r.errorJson).length;
  const failureCount = stepRuns.filter((r) => r.errorJson).length;
  const successRate = totalRuns > 0 ? successCount / totalRuns : 0;

  const durations = stepRuns
    .filter((r) => r.completedAt !== null)
    // completedAt is non-null after the filter above; cast is safe
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .map((r) => r.completedAt!.getTime() - r.startedAt.getTime())
    .sort((a, b) => a - b);

  const medianDurationMs = computeMedian(durations);
  const p95DurationMs = computeP95(durations);

  const avgRetryCount =
    totalRuns > 0 ? stepRuns.reduce((sum, r) => sum + r.retryCount, 0) / totalRuns : 0;

  const tokenUsages = stepRuns.map((r) => parseTokenUsage((r as Record<string, unknown>).tokenUsageJson as string | null | undefined));
  const avgInputTokens =
    totalRuns > 0 ? tokenUsages.reduce((sum, t) => sum + t.inputTokens, 0) / totalRuns : 0;
  const avgOutputTokens =
    totalRuns > 0 ? tokenUsages.reduce((sum, t) => sum + t.outputTokens, 0) / totalRuns : 0;

  return {
    metrics: {
      stepId: stepData.stepId,
      stepType: stepData.stepType,
      totalRuns,
      successCount,
      failureCount,
      successRate,
      medianDurationMs,
      p95DurationMs,
      avgRetryCount,
      avgInputTokens,
      avgOutputTokens
    },
    successCount,
    failureCount
  };
}

function computeHealthScore(definitionSuccessRate: number): number {
  let healthScore = Math.round(definitionSuccessRate * 100);
  if (definitionSuccessRate >= 0.9) {
    healthScore = 100;
  } else if (definitionSuccessRate >= 0.8) {
    healthScore = 85;
  } else if (definitionSuccessRate >= 0.7) {
    healthScore = 70;
  }
  return healthScore;
}

type StepRunWithRun = Awaited<ReturnType<PrismaClient["workflowStepRun"]["findMany"]>>[number] & { run: { definitionName: string } };

function groupByDefinition(stepRuns: StepRunWithRun[]): Map<string, StepRunWithRun[]> {
  const map = new Map<string, StepRunWithRun[]>();
  for (const stepRun of stepRuns) {
    const defName = stepRun.run.definitionName;
    const existing = map.get(defName);
    if (existing) {
      existing.push(stepRun);
    } else {
      map.set(defName, [stepRun]);
    }
  }
  return map;
}

function computeDefinitionResult(definitionName: string, runs: StepRunWithRun[]): DefinitionMetrics {
  const stepMap = new Map<string, { stepId: string; stepType: string; runs: StepRunWithRun[] }>();
  for (const stepRun of runs) {
    const existing = stepMap.get(stepRun.stepId);
    if (existing) {
      existing.runs.push(stepRun);
    } else {
      stepMap.set(stepRun.stepId, { stepId: stepRun.stepId, stepType: stepRun.stepType, runs: [stepRun] });
    }
  }

  const stepMetrics: StepMetrics[] = [];
  let totalDefinitionSuccesses = 0;
  for (const [, stepData] of stepMap) {
    const { metrics, successCount } = computeStepMetrics(stepData.runs, stepData);
    stepMetrics.push(metrics);
    totalDefinitionSuccesses += successCount;
  }

  const totalRuns = runs.length;
  const successRate = totalRuns > 0 ? totalDefinitionSuccesses / totalRuns : 0;
  return { definitionName, totalRuns, successRate, healthScore: computeHealthScore(successRate), steps: stepMetrics };
}

/**
 * Get workflow analytics for one or all workflow definitions
 */
export async function getWorkflowAnalytics(
  db: PrismaClient,
  options: GetAnalyticsOptions = {}
): Promise<DefinitionMetrics[]> {
  const since = options.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const whereClause = {
    startedAt: { gte: since },
    ...(options.definitionName !== undefined
      ? { run: { definitionName: options.definitionName } }
      : {})
  };

  const stepRuns = await db.workflowStepRun.findMany({
    where: whereClause,
    include: { run: true }
  }) as StepRunWithRun[];

  const definitionMap = groupByDefinition(stepRuns);
  const results = [...definitionMap].map(([name, runs]) => computeDefinitionResult(name, runs));
  return results.sort((a, b) => a.definitionName.localeCompare(b.definitionName));
}
