import type { CodeReviewAgentReview, CodeReviewPullRequestDetail, CodeReviewReviewAction, ReviewLane } from "@taxes/shared";

import type { ReviewEvidencePresentation } from "./review-evidence.js";
import { buildReviewEvidencePresentation } from "./review-evidence.js";
import type { FollowUpActionTone } from "./use-follow-up-action.js";
import type { ReviewActionTone } from "./use-review-action.js";
import type { ReviewNotebookEntry, TrustSummary } from "./walkthrough.js";

export interface ValidationReviewProps {
  readonly agentReview?: CodeReviewAgentReview;
  readonly canCreateFollowUp: boolean;
  readonly evidencePresentation: ReviewEvidencePresentation;
  readonly followUpActionMessage: string | null;
  readonly followUpActionTone: FollowUpActionTone;
  readonly isCreatingFollowUp: boolean;
  readonly isSubmittingReviewAction: boolean;
  readonly isVisible: boolean;
  readonly onCreateFollowUp: () => Promise<void>;
  readonly onSubmitReviewAction: (action: CodeReviewReviewAction) => Promise<void>;
  readonly reviewActionMessage: string | null;
  readonly reviewActionTone: ReviewActionTone;
  readonly totalLaneCount: number;
  readonly trustSummary: TrustSummary;
}

export function buildValidationReviewProps({
  activeEntry,
  activeLane,
  followUpActionMessage,
  followUpActionTone,
  isCreatingFollowUp,
  isSubmittingReviewAction,
  onCreateFollowUp,
  onSubmitReviewAction,
  pullRequest,
  reviewActionMessage,
  reviewActionTone,
  totalLaneCount,
  trustSummary
}: {
  readonly activeEntry: ReviewNotebookEntry;
  readonly activeLane: ReviewLane;
  readonly followUpActionMessage: string | null;
  readonly followUpActionTone: FollowUpActionTone;
  readonly isCreatingFollowUp: boolean;
  readonly isSubmittingReviewAction: boolean;
  readonly onCreateFollowUp: () => Promise<void>;
  readonly onSubmitReviewAction: (action: CodeReviewReviewAction) => Promise<void>;
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly reviewActionMessage: string | null;
  readonly reviewActionTone: ReviewActionTone;
  readonly totalLaneCount: number;
  readonly trustSummary: TrustSummary;
}): ValidationReviewProps {
  return {
    ...(pullRequest.agentReview === undefined ? {} : { agentReview: pullRequest.agentReview }),
    canCreateFollowUp: activeEntry.followUps.trim().length > 0,
    evidencePresentation: buildReviewEvidencePresentation(pullRequest),
    followUpActionMessage,
    followUpActionTone,
    isCreatingFollowUp,
    isSubmittingReviewAction,
    isVisible: activeLane.id === "validation",
    onCreateFollowUp,
    onSubmitReviewAction,
    reviewActionMessage,
    reviewActionTone,
    totalLaneCount,
    trustSummary
  };
}
