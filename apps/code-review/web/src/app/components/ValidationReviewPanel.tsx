import type { CodeReviewAgentReview } from "@taxes/shared";
import { Stack } from "@mui/material";

import type { FollowUpActionTone } from "../use-follow-up-action.js";
import type { ReviewEvidencePresentation } from "../review-evidence.js";
import type { TrustSummary } from "../walkthrough.js";
import { AgentReviewPanel } from "./AgentReviewPanel.js";
import { ReviewEvidencePanel } from "./ReviewEvidencePanel.js";
import { TrustSummaryPanel } from "./TrustSummaryPanel.js";

interface ValidationReviewPanelProps {
  readonly agentReview?: CodeReviewAgentReview;
  readonly canCreateFollowUp: boolean;
  readonly evidencePresentation: ReviewEvidencePresentation;
  readonly followUpActionMessage: string | null;
  readonly followUpActionTone: FollowUpActionTone;
  readonly isCreatingFollowUp: boolean;
  readonly isVisible: boolean;
  readonly onCreateFollowUp: () => Promise<void>;
  readonly totalLaneCount: number;
  readonly trustSummary: TrustSummary;
}

export function ValidationReviewPanel({
  agentReview,
  canCreateFollowUp,
  evidencePresentation,
  followUpActionMessage,
  followUpActionTone,
  isCreatingFollowUp,
  isVisible,
  onCreateFollowUp,
  totalLaneCount,
  trustSummary
}: ValidationReviewPanelProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <Stack spacing={2}>
      {agentReview === undefined ? null : <AgentReviewPanel review={agentReview} />}
      <ReviewEvidencePanel presentation={evidencePresentation} />
      <TrustSummaryPanel
        canCreateFollowUp={canCreateFollowUp}
        followUpActionMessage={followUpActionMessage}
        followUpActionTone={followUpActionTone}
        isCreatingFollowUp={isCreatingFollowUp}
        onCreateFollowUp={() => {
          void onCreateFollowUp();
        }}
        summary={trustSummary}
        totalLaneCount={totalLaneCount}
      />
    </Stack>
  );
}
