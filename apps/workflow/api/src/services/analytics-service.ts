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

/**
 * Get workflow analytics for one or all workflow definitions
 */
export async function getWorkflowAnalytics(
  db: PrismaClient,
  options: GetAnalyticsOptions = {}
): Promise<DefinitionMetrics[]> {
  const since = options.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  // Build where clause dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: any = {
    startedAt: { gte: since }
  };
  if (options.definitionName) {
    whereClause.run = { definitionName: options.definitionName };
  }

  // Fetch all step runs with their parent run info
  const stepRuns = await db.workflowStepRun.findMany({
    where: whereClause,
    include: {
      run: true
    }
  });

  // Group by definition name
  const definitionMap = new Map<string, typeof stepRuns>();
  for (const stepRun of stepRuns) {
    const defName = stepRun.run.definitionName;
    if (!definitionMap.has(defName)) {
      definitionMap.set(defName, []);
    }
    definitionMap.get(defName)!.push(stepRun);
  }

  // Build metrics for each definition
  const results: DefinitionMetrics[] = [];
  for (const [definitionName, runs] of definitionMap) {
    // Group step runs by step ID and step type
    const stepMap = new Map<
      string,
      { stepId: string; stepType: string; runs: typeof stepRuns }
    >();
    for (const stepRun of runs) {
      const key = `${stepRun.stepId}`;
      if (!stepMap.has(key)) {
        stepMap.set(key, {
          stepId: stepRun.stepId,
          stepType: stepRun.stepType,
          runs: []
        });
      }
      stepMap.get(key)!.runs.push(stepRun);
    }

    // Compute metrics per step
    const stepMetrics: StepMetrics[] = [];
    let totalDefinitionSuccesses = 0;
    let totalDefinitionFailures = 0;

    for (const [, stepData] of stepMap) {
      const stepRuns = stepData.runs;
      const totalRuns = stepRuns.length;
      const successCount = stepRuns.filter((r) => !r.errorJson).length;
      const failureCount = stepRuns.filter((r) => r.errorJson).length;
      const successRate = totalRuns > 0 ? successCount / totalRuns : 0;

      // Compute durations (ms)
      const durations = stepRuns
        .filter((r) => r.completedAt && r.startedAt)
        .map((r) => new Date(r.completedAt!).getTime() - new Date(r.startedAt).getTime())
        .sort((a, b) => a - b);

      const medianDurationMs = computeMedian(durations);
      const p95DurationMs = computeP95(durations);

      // Average retry count
      const avgRetryCount =
        totalRuns > 0 ? stepRuns.reduce((sum, r) => sum + r.retryCount, 0) / totalRuns : 0;

      // Average token usage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenUsages = stepRuns.map((r) => parseTokenUsage((r as any).tokenUsageJson));
      const avgInputTokens =
        totalRuns > 0 ? tokenUsages.reduce((sum, t) => sum + t.inputTokens, 0) / totalRuns : 0;
      const avgOutputTokens =
        totalRuns > 0
          ? tokenUsages.reduce((sum, t) => sum + t.outputTokens, 0) / totalRuns
          : 0;

      stepMetrics.push({
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
      });

      totalDefinitionSuccesses += successCount;
      totalDefinitionFailures += failureCount;
    }

    // Compute definition-level health score (weighted by run count)
    const totalDefinitionRuns = runs.length;
    const definitionSuccessRate =
      totalDefinitionRuns > 0
        ? totalDefinitionSuccesses / totalDefinitionRuns
        : 0;

    // Health score: 0-100, based on success rate
    // >= 90% success = 100
    // >= 80% success = 80
    // >= 70% success = 60
    // < 70% success = max(0, 40 + (successRate - 0.5) * 100)
    let healthScore = Math.round(definitionSuccessRate * 100);
    if (definitionSuccessRate >= 0.9) {
      healthScore = 100;
    } else if (definitionSuccessRate >= 0.8) {
      healthScore = 85;
    } else if (definitionSuccessRate >= 0.7) {
      healthScore = 70;
    }

    results.push({
      definitionName,
      totalRuns: totalDefinitionRuns,
      successRate: definitionSuccessRate,
      healthScore,
      steps: stepMetrics
    });
  }

  return results.sort((a, b) => a.definitionName.localeCompare(b.definitionName));
}
