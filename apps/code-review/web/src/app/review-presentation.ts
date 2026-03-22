import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildPullRequestStory } from "./pull-request-story.js";
import { formatPullRequestState } from "./index.js";

export interface ReviewDecisionAction {
  readonly description: string;
  readonly title: string;
}

export interface ReviewOverviewSection {
  readonly items: string[];
  readonly title: string;
}

export interface ReviewOverviewPresentation {
  readonly detailSections: ReviewOverviewSection[];
  readonly heroEyebrow: string;
  readonly heroSummary: string[];
  readonly heroTitle: string;
  readonly metaChips: string[];
  readonly primaryActions: readonly ReviewDecisionAction[];
}

const PRIMARY_ACTIONS: readonly ReviewDecisionAction[] = [
  {
    description: "Confirm the linked work item, review order, and code areas before reading the diff.",
    title: "Start with context"
  },
  {
    description: "Use the staged walkthrough to review risks, tests, implementation, docs, and sign-off in order.",
    title: "Walk the PR"
  },
  {
    description: "Record follow-ups or improvement ideas instead of losing them in chat or comments.",
    title: "Capture improvements"
  }
] as const;

export function buildReviewOverviewPresentation(pullRequest: CodeReviewPullRequestDetail): ReviewOverviewPresentation {
  const story = buildPullRequestStory(pullRequest);
  const workItemLabel = pullRequest.planningWorkItem?.workItemId ?? pullRequest.linkedPlan?.workItemId ?? "Unlinked PR";
  const heroEyebrow = `${workItemLabel} | PR #${pullRequest.number.toString()} | ${formatPullRequestState(pullRequest.state, pullRequest.isDraft)}`;
  const heroTitle = story.whyItMatters[0] ?? pullRequest.title;

  return {
    detailSections: buildDetailSections(pullRequest, story),
    heroEyebrow,
    heroSummary: [
      ...(pullRequest.narrative.valueSummary.length > 0 ? [pullRequest.narrative.valueSummary] : []),
      ...story.whyItMatters.slice(1, 3)
    ],
    heroTitle,
    metaChips: buildMetaChips(pullRequest),
    primaryActions: PRIMARY_ACTIONS
  };
}

function buildDetailSections(
  pullRequest: CodeReviewPullRequestDetail,
  story: ReturnType<typeof buildPullRequestStory>
): ReviewOverviewSection[] {
  return [
    {
      items: buildWorkItemContext(pullRequest),
      title: "Work Item Context"
    },
    {
      items: story.codebaseStory.length > 0 ? story.codebaseStory : ["The PR body did not identify changed repository areas yet."],
      title: "Code Areas To Review"
    },
    {
      items: pullRequest.narrative.reviewOrder.length > 0 ? pullRequest.narrative.reviewOrder : ["Context", "Risks", "Tests", "Implementation", "Validation", "Docs"],
      title: "Recommended Review Order"
    }
  ];
}

function buildWorkItemContext(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.planningWorkItem !== undefined) {
    return [
      pullRequest.planningWorkItem.title,
      pullRequest.planningWorkItem.summary,
      `Status: ${pullRequest.planningWorkItem.status}`,
      `${pullRequest.planningWorkItem.tasks.completeCount.toString()}/${pullRequest.planningWorkItem.tasks.totalCount.toString()} tasks complete`,
      `${pullRequest.planningWorkItem.acceptanceCriteria.completeCount.toString()}/${pullRequest.planningWorkItem.acceptanceCriteria.totalCount.toString()} acceptance criteria complete`,
      ...(pullRequest.planningWorkItem.latestPlanRun?.currentStepTitle === undefined
        ? []
        : [`Current step: ${pullRequest.planningWorkItem.latestPlanRun.currentStepTitle}`])
    ];
  }

  if (pullRequest.linkedPlan !== undefined) {
    return [
      `${pullRequest.linkedPlan.workItemId} is linked from the ${pullRequest.linkedPlan.source}.`,
      "Richer planning detail is not materialized in the review workspace yet."
    ];
  }

  return ["This pull request still needs a linked planning work item before review can be fully grounded."];
}

function buildMetaChips(pullRequest: CodeReviewPullRequestDetail): string[] {
  return [
    `${pullRequest.stats.fileCount.toString()} files`,
    `+${pullRequest.stats.totalAdditions.toString()} / -${pullRequest.stats.totalDeletions.toString()}`,
    `Merge: ${pullRequest.mergeStateStatus.toLowerCase()}`,
    pullRequest.linkedPlan === undefined ? "Needs plan link" : pullRequest.linkedPlan.workItemId
  ];
}
