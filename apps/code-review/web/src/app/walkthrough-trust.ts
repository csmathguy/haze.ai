import type { CodeReviewPullRequestDetail, ReviewLane } from "@taxes/shared";

import { orderWalkthroughLanes, type ReviewNotebook, type ReviewNotebookEntry } from "./walkthrough-core.js";

export type TrustCheckpointStatus = "attention" | "complete" | "pending";

export interface TrustSummary {
  readonly confirmedLaneCount: number;
  readonly evidenceCheckpoints: {
    readonly detail: string;
    readonly label: string;
    readonly status: TrustCheckpointStatus;
  }[];
  readonly followUpQueue: string[];
  readonly statusLabel: "Gather more evidence" | "Hold before decision" | "Ready for human decision";
  readonly statusTone: "secondary" | "success" | "warning";
  readonly valueSummary: string[];
}

interface CheckSummary {
  readonly failedCount: number;
  readonly pendingCount: number;
  readonly totalCount: number;
}

interface LaneReviewSummary {
  readonly blockingFollowUps: string[];
  readonly confirmedLaneCount: number;
  readonly hasReviewAttention: boolean;
  readonly laneCount: number;
  readonly laneFollowUps: string[];
}

export function buildTrustSummary(pullRequest: CodeReviewPullRequestDetail, notebook: ReviewNotebook): TrustSummary {
  const laneSummary = summarizeLaneReview(pullRequest, notebook);
  const checkSummary = summarizeChecks(pullRequest);
  const followUpQueue = buildFollowUpQueue(pullRequest, laneSummary, checkSummary);
  const statusLabel = determineStatusLabel(pullRequest, laneSummary, checkSummary);

  return {
    confirmedLaneCount: laneSummary.confirmedLaneCount,
    evidenceCheckpoints: buildEvidenceCheckpoints(pullRequest, laneSummary, checkSummary),
    followUpQueue,
    statusLabel,
    statusTone: toStatusTone(statusLabel),
    valueSummary: pullRequest.narrative.summaryBullets.slice(0, 3)
  };
}

function summarizeLaneReview(pullRequest: CodeReviewPullRequestDetail, notebook: ReviewNotebook): LaneReviewSummary {
  const orderedLanes = orderWalkthroughLanes(pullRequest.lanes);
  const laneFollowUps = orderedLanes.flatMap((lane) => summarizeLaneEntry(lane, notebook[lane.id]));

  return {
    blockingFollowUps: dedupe(laneFollowUps.filter((value) => !value.endsWith("checkpoint not confirmed yet"))),
    confirmedLaneCount: orderedLanes.filter((lane) => notebook[lane.id].status === "confirmed").length,
    hasReviewAttention: orderedLanes.some((lane) => {
      const entry = notebook[lane.id];
      return entry.status === "needs-follow-up" || entry.concerns.trim().length > 0;
    }),
    laneCount: orderedLanes.length,
    laneFollowUps
  };
}

function summarizeLaneEntry(lane: ReviewLane, entry: ReviewNotebookEntry): string[] {
  const explicitFollowUps = entry.followUps
    .split("\n")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => `${lane.title}: ${value}`);

  if (entry.status === "needs-follow-up") {
    return [`${lane.title}: follow-up requested`, ...explicitFollowUps];
  }

  if (entry.concerns.trim().length > 0) {
    return [`${lane.title}: ${entry.concerns.trim()}`, ...explicitFollowUps];
  }

  if (entry.status !== "confirmed") {
    return [`${lane.title}: checkpoint not confirmed yet`, ...explicitFollowUps];
  }

  return explicitFollowUps;
}

function summarizeChecks(pullRequest: CodeReviewPullRequestDetail): CheckSummary {
  return pullRequest.checks.reduce(
    (summary, check) => {
      if (isFailedCheck(check)) {
        return {
          ...summary,
          failedCount: summary.failedCount + 1
        };
      }

      if (isPendingCheck(check)) {
        return {
          ...summary,
          pendingCount: summary.pendingCount + 1
        };
      }

      return summary;
    },
    {
      failedCount: 0,
      pendingCount: 0,
      totalCount: pullRequest.checks.length
    }
  );
}

function buildFollowUpQueue(
  pullRequest: CodeReviewPullRequestDetail,
  laneSummary: LaneReviewSummary,
  checkSummary: CheckSummary
): string[] {
  return dedupe([
    ...laneSummary.laneFollowUps,
    ...buildContextFollowUps(pullRequest),
    ...buildCheckFollowUps(checkSummary),
    ...(pullRequest.evidenceWarnings ?? []),
    ...(pullRequest.auditEvidence !== undefined && pullRequest.auditEvidence.failureCount > 0
      ? [`Audit lineage includes ${formatCount(pullRequest.auditEvidence.failureCount, "recorded failure")}.`]
      : [])
  ]);
}

function buildContextFollowUps(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.linkedPlan === undefined) {
    return ["Link this pull request to a planning work item so review, audit, and downstream closure stay connected."];
  }

  return [
    ...(pullRequest.isDraft ? ["Pull request is still marked as draft on GitHub."] : []),
    ...(pullRequest.planningWorkItem === undefined && !hasPlanningWarning(pullRequest)
      ? [`Planning context for ${pullRequest.linkedPlan.workItemId} has not been materialized in the review workspace yet.`]
      : []),
    ...(pullRequest.auditEvidence === undefined && !hasAuditWarning(pullRequest)
      ? [`Audit lineage for ${pullRequest.linkedPlan.workItemId} is not available in the review workspace yet.`]
      : [])
  ];
}

function buildCheckFollowUps(checkSummary: CheckSummary): string[] {
  if (checkSummary.totalCount === 0) {
    return ["No reported checks were attached to this pull request."];
  }

  return [
    ...(checkSummary.failedCount > 0 ? [`${formatCount(checkSummary.failedCount, "reported check")} still need attention.`] : []),
    ...(checkSummary.pendingCount > 0 ? [`${formatCount(checkSummary.pendingCount, "check")} are still pending.`] : [])
  ];
}

function buildEvidenceCheckpoints(
  pullRequest: CodeReviewPullRequestDetail,
  laneSummary: LaneReviewSummary,
  checkSummary: CheckSummary
): TrustSummary["evidenceCheckpoints"] {
  return [
    buildReviewCoverageCheckpoint(laneSummary),
    buildPlanningCheckpoint(pullRequest),
    buildAuditCheckpoint(pullRequest),
    buildValidationCheckpoint(checkSummary),
    buildMergeCheckpoint(pullRequest)
  ];
}

function buildReviewCoverageCheckpoint(laneSummary: LaneReviewSummary): TrustSummary["evidenceCheckpoints"][number] {
  return {
    detail: `${laneSummary.confirmedLaneCount.toString()} of ${laneSummary.laneCount.toString()} walkthrough checkpoints confirmed`,
    label: "Review coverage",
    status: resolveReviewCoverageStatus(laneSummary)
  };
}

function buildPlanningCheckpoint(pullRequest: CodeReviewPullRequestDetail): TrustSummary["evidenceCheckpoints"][number] {
  if (pullRequest.planningWorkItem !== undefined) {
    return {
      detail: `${pullRequest.planningWorkItem.workItemId} is ${pullRequest.planningWorkItem.status}`,
      label: "Planning context",
      status: "complete"
    };
  }

  if (pullRequest.linkedPlan === undefined) {
    return {
      detail: "No linked work item yet",
      label: "Planning context",
      status: "pending"
    };
  }

  return {
    detail: `Waiting on ${pullRequest.linkedPlan.workItemId}`,
    label: "Planning context",
    status: "attention"
  };
}

function buildAuditCheckpoint(pullRequest: CodeReviewPullRequestDetail): TrustSummary["evidenceCheckpoints"][number] {
  if (pullRequest.auditEvidence !== undefined) {
    return {
      detail: formatCount(pullRequest.auditEvidence.runCount, "linked run"),
      label: "Audit lineage",
      status: pullRequest.auditEvidence.failureCount > 0 ? "attention" : "complete"
    };
  }

  if (pullRequest.linkedPlan === undefined) {
    return {
      detail: "No work item means no lineage",
      label: "Audit lineage",
      status: "pending"
    };
  }

  return {
    detail: `No linked audit timeline for ${pullRequest.linkedPlan.workItemId}`,
    label: "Audit lineage",
    status: "attention"
  };
}

function buildValidationCheckpoint(checkSummary: CheckSummary): TrustSummary["evidenceCheckpoints"][number] {
  if (checkSummary.failedCount > 0) {
    return {
      detail: `${checkSummary.failedCount.toString()} failed`,
      label: "Validation signals",
      status: "attention"
    };
  }

  if (checkSummary.pendingCount > 0) {
    return {
      detail: `${checkSummary.pendingCount.toString()} pending`,
      label: "Validation signals",
      status: "pending"
    };
  }

  if (checkSummary.totalCount === 0) {
    return {
      detail: "No reported checks",
      label: "Validation signals",
      status: "pending"
    };
  }

  return {
    detail: `${checkSummary.totalCount.toString()} passing`,
    label: "Validation signals",
    status: "complete"
  };
}

function buildMergeCheckpoint(pullRequest: CodeReviewPullRequestDetail): TrustSummary["evidenceCheckpoints"][number] {
  return {
    detail: formatMergePosture(pullRequest),
    label: "Merge posture",
    status: pullRequest.isDraft ? "attention" : "complete"
  };
}

function determineStatusLabel(
  pullRequest: CodeReviewPullRequestDetail,
  laneSummary: LaneReviewSummary,
  checkSummary: CheckSummary
): TrustSummary["statusLabel"] {
  if (isDecisionBlocked(pullRequest, laneSummary, checkSummary)) {
    return "Hold before decision";
  }

  if (
    laneSummary.laneCount > 0 &&
    laneSummary.confirmedLaneCount === laneSummary.laneCount &&
    pullRequest.planningWorkItem !== undefined &&
    pullRequest.auditEvidence !== undefined &&
    checkSummary.pendingCount === 0 &&
    checkSummary.failedCount === 0
  ) {
    return "Ready for human decision";
  }

  return "Gather more evidence";
}

function isDecisionBlocked(
  pullRequest: CodeReviewPullRequestDetail,
  laneSummary: LaneReviewSummary,
  checkSummary: CheckSummary
): boolean {
  return (
    pullRequest.isDraft ||
    checkSummary.failedCount > 0 ||
    laneSummary.blockingFollowUps.length > 0 ||
    (pullRequest.auditEvidence?.failureCount ?? 0) > 0 ||
    (pullRequest.evidenceWarnings ?? []).some((warning) => warning.includes("could not be loaded") || warning.includes("was not found"))
  );
}

function hasPlanningWarning(pullRequest: CodeReviewPullRequestDetail): boolean {
  return (pullRequest.evidenceWarnings ?? []).some((warning) => warning.toLowerCase().includes("planning"));
}

function hasAuditWarning(pullRequest: CodeReviewPullRequestDetail): boolean {
  return (pullRequest.evidenceWarnings ?? []).some((warning) => warning.toLowerCase().includes("audit"));
}

function isFailedCheck(check: CodeReviewPullRequestDetail["checks"][number]): boolean {
  const conclusion = check.conclusion?.toUpperCase();

  return check.status.toUpperCase() === "COMPLETED" && conclusion !== undefined && !["NEUTRAL", "SKIPPED", "SUCCESS"].includes(conclusion);
}

function isPendingCheck(check: CodeReviewPullRequestDetail["checks"][number]): boolean {
  if (check.status.toUpperCase() !== "COMPLETED") {
    return true;
  }

  return check.conclusion === undefined;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function resolveReviewCoverageStatus(laneSummary: LaneReviewSummary): TrustCheckpointStatus {
  if (laneSummary.confirmedLaneCount === laneSummary.laneCount && laneSummary.laneCount > 0) {
    return "complete";
  }

  if (laneSummary.hasReviewAttention) {
    return "attention";
  }

  return "pending";
}

function toStatusTone(statusLabel: TrustSummary["statusLabel"]): TrustSummary["statusTone"] {
  switch (statusLabel) {
    case "Ready for human decision":
      return "success";
    case "Hold before decision":
      return "warning";
    case "Gather more evidence":
      return "secondary";
  }
}

function formatMergePosture(pullRequest: CodeReviewPullRequestDetail): string {
  return pullRequest.isDraft ? `Draft PR with merge state ${pullRequest.mergeStateStatus.toLowerCase()}` : pullRequest.mergeStateStatus.toLowerCase();
}

function formatCount(count: number, label: string): string {
  return `${count.toString()} ${label}${count === 1 ? "" : "s"}`;
}
