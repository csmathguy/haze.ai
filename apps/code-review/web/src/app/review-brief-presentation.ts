import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { formatPullRequestState } from "./index.js";

export interface ReviewBriefChecklistSection {
  readonly items: string[];
  readonly title: string;
}

export interface ReviewBriefPresentation {
  readonly checklistSections: ReviewBriefChecklistSection[];
  readonly compactStatus: string[];
  readonly inspectFirst: string[];
  readonly missingEvidence: string[];
  readonly nextStepTitle: string;
  readonly reviewGoal: string;
  readonly startHere: string[];
  readonly statusLabel: string;
  readonly summary: string;
  readonly workItemLabel: string;
  readonly title: string;
  readonly whatThisPrDoes: string[];
}

export function buildReviewBriefPresentation(
  pullRequest: CodeReviewPullRequestDetail,
  currentStageTitle: string
): ReviewBriefPresentation {
  const statusLabel = formatPullRequestState(pullRequest.state, pullRequest.isDraft);
  const content = resolveReviewBriefContent(pullRequest, currentStageTitle);

  return {
    checklistSections: buildChecklistSections(pullRequest),
    compactStatus: buildCompactStatus(pullRequest),
    inspectFirst: content.inspectFirst,
    missingEvidence: content.missingEvidence,
    nextStepTitle: currentStageTitle,
    reviewGoal: buildReviewGoal(pullRequest),
    startHere: content.startHere,
    statusLabel,
    summary: content.summary,
    workItemLabel: pullRequest.planningWorkItem?.workItemId ?? pullRequest.linkedPlan?.workItemId ?? "Unlinked PR",
    title: pullRequest.planningWorkItem?.title ?? pullRequest.title,
    whatThisPrDoes: content.whatThisPrDoes
  };
}

function buildCompactStatus(pullRequest: CodeReviewPullRequestDetail): string[] {
  const items = [
    `PR #${pullRequest.number.toString()} is ${formatPullRequestState(pullRequest.state, pullRequest.isDraft).toLowerCase()}.`,
    ...(pullRequest.state === "OPEN" && !pullRequest.isDraft ? ["Review state: under review."] : []),
    ...(pullRequest.planningWorkItem === undefined ? [] : [`Work item is ${pullRequest.planningWorkItem.status}.`])
  ];

  if (pullRequest.planningWorkItem?.latestPlanRun?.currentStepTitle !== undefined) {
    items.push(`Current step: ${pullRequest.planningWorkItem.latestPlanRun.currentStepTitle}.`);
  }

  return items;
}

function buildChecklistSections(pullRequest: CodeReviewPullRequestDetail): ReviewBriefChecklistSection[] {
  if (pullRequest.planningWorkItem === undefined) {
    return [];
  }

  const sections: ReviewBriefChecklistSection[] = [];

  if (pullRequest.planningWorkItem.acceptanceCriteriaPreview.items.length > 0) {
    sections.push({
      items: pullRequest.planningWorkItem.acceptanceCriteriaPreview.items,
      title: `Acceptance criteria (${pullRequest.planningWorkItem.acceptanceCriteria.completeCount.toString()}/${pullRequest.planningWorkItem.acceptanceCriteria.totalCount.toString()} complete)`
    });
  }

  if (pullRequest.planningWorkItem.taskPreview.items.length > 0) {
    sections.push({
      items: pullRequest.planningWorkItem.taskPreview.items,
      title: `Planned tasks (${pullRequest.planningWorkItem.tasks.completeCount.toString()}/${pullRequest.planningWorkItem.tasks.totalCount.toString()} complete)`
    });
  }

  return sections;
}

function buildReviewGoal(pullRequest: CodeReviewPullRequestDetail): string {
  if (pullRequest.planningWorkItem !== undefined) {
    return pullRequest.planningWorkItem.summary;
  }

  return pullRequest.narrative.valueSummary;
}

function fallbackInspectFirst(pullRequest: CodeReviewPullRequestDetail): string[] {
  return pullRequest.lanes
    .flatMap((lane) => lane.highlights.slice(0, 1))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3);
}

function fallbackStartHere(pullRequest: CodeReviewPullRequestDetail, currentStageTitle: string): string[] {
  return [
    `Read the PR goal before reviewing code: ${pullRequest.narrative.valueSummary}`,
    `Finish the current step: ${currentStageTitle}.`,
    ...(pullRequest.linkedPlan === undefined ? ["Link the PR to a work item before final approval."] : [])
  ];
}

function fallbackWhatThisPrDoes(pullRequest: CodeReviewPullRequestDetail): string[] {
  return [
    ...pullRequest.narrative.summaryBullets.slice(0, 3),
    ...pullRequest.narrative.whatChangedSections.map((section) => `${section.title}: ${section.items.join(", ")}`).slice(0, 1)
  ].filter((value, index, values) => values.indexOf(value) === index);
}

function resolveReviewBriefContent(pullRequest: CodeReviewPullRequestDetail, currentStageTitle: string): {
  readonly inspectFirst: string[];
  readonly missingEvidence: string[];
  readonly startHere: string[];
  readonly summary: string;
  readonly whatThisPrDoes: string[];
} {
  const reviewBrief = pullRequest.reviewBrief;

  if (reviewBrief !== undefined) {
    return {
      inspectFirst: reviewBrief.inspectFirst,
      missingEvidence: reviewBrief.missingEvidence,
      startHere: reviewBrief.startHere,
      summary: reviewBrief.summary,
      whatThisPrDoes: reviewBrief.whatThisPrDoes
    };
  }

  return {
    inspectFirst: fallbackInspectFirst(pullRequest),
    missingEvidence: [],
    startHere: fallbackStartHere(pullRequest, currentStageTitle),
    summary: pullRequest.narrative.valueSummary,
    whatThisPrDoes: fallbackWhatThisPrDoes(pullRequest)
  };
}
