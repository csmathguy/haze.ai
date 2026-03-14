import type { CodeReviewPullRequestDetail, ReviewLane } from "@taxes/shared";

interface CheckSummary {
  readonly failedCount: number;
  readonly pendingCount: number;
  readonly passingCount: number;
  readonly totalCount: number;
}

export interface PullRequestStory {
  readonly codebaseStory: string[];
  readonly reviewQuestions: string[];
  readonly trustSignals: string[];
  readonly validationCommands: string[];
  readonly validationOverview: string[];
  readonly whyItMatters: string[];
}

export interface LaneNarrativePresentation {
  readonly evidence: string[];
  readonly highlights: string[];
  readonly questions: string[];
}

export function buildPullRequestStory(pullRequest: CodeReviewPullRequestDetail): PullRequestStory {
  const checkSummary = summarizeChecks(pullRequest);

  return {
    codebaseStory: buildCodebaseStory(pullRequest),
    reviewQuestions: buildReviewQuestions(pullRequest),
    trustSignals: buildTrustSignals(pullRequest, checkSummary),
    validationCommands: dedupeStrings(pullRequest.narrative.validationCommands),
    validationOverview: buildValidationOverview(checkSummary),
    whyItMatters: buildWhyItMatters(pullRequest)
  };
}

export function buildLaneNarrativePresentation(
  pullRequest: CodeReviewPullRequestDetail,
  lane: ReviewLane
): LaneNarrativePresentation {
  if (lane.id !== "validation") {
    return {
      evidence: limitItems(dedupeStrings(lane.evidence)),
      highlights: limitItems(dedupeStrings(lane.highlights)),
      questions: limitItems(dedupeStrings(lane.questions))
    };
  }

  return {
    evidence: buildValidationEvidence(pullRequest),
    highlights: buildValidationHighlights(pullRequest),
    questions: limitItems(dedupeStrings(lane.questions))
  };
}

function buildWhyItMatters(pullRequest: CodeReviewPullRequestDetail): string[] {
  return limitItems(
    dedupeStrings([
      ...(pullRequest.planningWorkItem === undefined ? [] : [pullRequest.planningWorkItem.summary]),
      ...pullRequest.narrative.summaryBullets
    ]),
    4
  );
}

function buildCodebaseStory(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.narrative.whatChangedSections.length > 0) {
    return limitItems(
      pullRequest.narrative.whatChangedSections.map((section) => `${section.title}: ${section.items.slice(0, 3).join(", ")}`),
      4
    );
  }

  const areaSummary = new Map<string, number>();

  for (const lane of pullRequest.lanes) {
    for (const file of lane.files) {
      areaSummary.set(file.areaLabel, (areaSummary.get(file.areaLabel) ?? 0) + 1);
    }
  }

  return limitItems(
    [...areaSummary.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([area, fileCount]) => `${area}: ${formatCount(fileCount, "changed file")}`),
    4
  );
}

function buildTrustSignals(pullRequest: CodeReviewPullRequestDetail, checkSummary: CheckSummary): string[] {
  return limitItems(
    dedupeStrings([
      ...buildValidationOverview(checkSummary),
      ...(pullRequest.planningWorkItem === undefined
        ? []
        : [
            `${pullRequest.planningWorkItem.tasks.completeCount.toString()}/${pullRequest.planningWorkItem.tasks.totalCount.toString()} planned tasks complete`,
            `${pullRequest.planningWorkItem.acceptanceCriteria.completeCount.toString()}/${pullRequest.planningWorkItem.acceptanceCriteria.totalCount.toString()} acceptance criteria cleared`
          ]),
      ...(pullRequest.auditEvidence === undefined
        ? []
        : [
            `${formatCount(pullRequest.auditEvidence.runCount, "linked audit run")} available`,
            `${pullRequest.auditEvidence.failureCount.toString()} recorded audit failures`,
            `${pullRequest.auditEvidence.handoffCount.toString()} recorded handoffs`
          ]),
      `${pullRequest.mergeStateStatus.toLowerCase()} merge posture on GitHub`
    ]),
    5
  );
}

function buildReviewQuestions(pullRequest: CodeReviewPullRequestDetail): string[] {
  return limitItems(
    dedupeStrings([
      ...pullRequest.narrative.reviewFocus,
      ...pullRequest.narrative.risks,
      ...buildMissingContextWarnings(pullRequest)
    ]),
    5
  );
}

function buildMissingContextWarnings(pullRequest: CodeReviewPullRequestDetail): string[] {
  return [
    ...(pullRequest.linkedPlan === undefined ? ["This pull request still needs a linked planning work item."] : []),
    ...(pullRequest.evidenceWarnings ?? [])
  ];
}

function buildValidationHighlights(pullRequest: CodeReviewPullRequestDetail): string[] {
  return limitItems(
    dedupeStrings([
      ...buildValidationOverview(summarizeChecks(pullRequest)),
      ...(pullRequest.narrative.validationCommands.length > 0
        ? [`${formatCount(dedupeStrings(pullRequest.narrative.validationCommands).length, "explicit validation command")} attached to the PR narrative`]
        : ["No explicit validation commands were attached to the PR narrative."])
    ]),
    4
  );
}

function buildValidationEvidence(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.checks.length === 0) {
    return ["No reported checks were attached to this pull request."];
  }

  return limitItems(
    dedupeStrings(
      pullRequest.checks.map((check) => `${check.workflowName ?? check.name}: ${formatCheckState(check.status, check.conclusion)}`)
    ),
    5
  );
}

function buildValidationOverview(checkSummary: CheckSummary): string[] {
  if (checkSummary.totalCount === 0) {
    return ["No reported checks were attached to this pull request."];
  }

  return [
    ...(checkSummary.failedCount > 0 ? [`${formatCount(checkSummary.failedCount, "check")} failed`] : ["No failing reported checks"]),
    ...(checkSummary.pendingCount > 0 ? [`${formatCount(checkSummary.pendingCount, "check")} still pending`] : ["No reported checks are pending"]),
    `${formatCount(checkSummary.totalCount, "reported check")} in total`
  ];
}

function summarizeChecks(pullRequest: CodeReviewPullRequestDetail): CheckSummary {
  return pullRequest.checks.reduce(
    (summary, check) => {
      if (isFailedCheck(check.status, check.conclusion)) {
        return {
          ...summary,
          failedCount: summary.failedCount + 1
        };
      }

      if (isPendingCheck(check.status, check.conclusion)) {
        return {
          ...summary,
          pendingCount: summary.pendingCount + 1
        };
      }

      return {
        ...summary,
        passingCount: summary.passingCount + 1
      };
    },
    {
      failedCount: 0,
      passingCount: 0,
      pendingCount: 0,
      totalCount: pullRequest.checks.length
    }
  );
}

function isFailedCheck(status: string, conclusion: string | undefined): boolean {
  const normalizedStatus = status.toUpperCase();
  const normalizedConclusion = conclusion?.toUpperCase();

  return normalizedStatus === "COMPLETED" && normalizedConclusion !== undefined && !["NEUTRAL", "SKIPPED", "SUCCESS"].includes(normalizedConclusion);
}

function isPendingCheck(status: string, conclusion: string | undefined): boolean {
  return status.toUpperCase() !== "COMPLETED" || conclusion === undefined;
}

function formatCheckState(status: string, conclusion: string | undefined): string {
  if (status.toUpperCase() !== "COMPLETED") {
    return status.toLowerCase();
  }

  return conclusion?.toLowerCase() ?? "completed";
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function limitItems(values: string[], limit = 5): string[] {
  return values.slice(0, limit);
}

function formatCount(count: number, singular: string): string {
  return `${count.toString()} ${singular}${count === 1 ? "" : "s"}`;
}
