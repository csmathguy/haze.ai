import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import type { ReactNode } from "react";
import type { CodeReviewAgentReview, CodeReviewReviewAction } from "@taxes/shared";
import { Accordion, AccordionDetails, AccordionSummary, Paper, Stack, Typography } from "@mui/material";

import type { FollowUpActionTone } from "../use-follow-up-action.js";
import type { ReviewEvidencePresentation } from "../review-evidence.js";
import type { ReviewActionTone } from "../use-review-action.js";
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
  readonly isSubmittingReviewAction: boolean;
  readonly isVisible: boolean;
  readonly onCreateFollowUp: () => Promise<void>;
  readonly onSubmitReviewAction: (action: CodeReviewReviewAction) => Promise<void>;
  readonly reviewActionMessage: string | null;
  readonly reviewActionTone: ReviewActionTone;
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
  isSubmittingReviewAction,
  isVisible,
  onCreateFollowUp,
  onSubmitReviewAction,
  reviewActionMessage,
  reviewActionTone,
  totalLaneCount,
  trustSummary
}: ValidationReviewPanelProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <TrustSummaryPanel
        canCreateFollowUp={canCreateFollowUp}
        followUpActionMessage={followUpActionMessage}
        followUpActionTone={followUpActionTone}
        isCreatingFollowUp={isCreatingFollowUp}
        isSubmittingReviewAction={isSubmittingReviewAction}
        onCreateFollowUp={() => {
          void onCreateFollowUp();
        }}
        onSubmitReviewAction={(action) => {
          void onSubmitReviewAction(action);
        }}
        reviewActionMessage={reviewActionMessage}
        reviewActionTone={reviewActionTone}
        summary={trustSummary}
        totalLaneCount={totalLaneCount}
      />
      <Paper sx={{ p: 2 }} variant="outlined">
        <Stack spacing={1.25}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Decision support</Typography>
            <Typography color="text.secondary" variant="body2">
              Open these only if you need more proof before deciding what should happen next in GitHub.
            </Typography>
          </Stack>
          <OptionalDetail title="Validation evidence">
            <ReviewEvidencePanel presentation={evidencePresentation} />
          </OptionalDetail>
          {agentReview === undefined ? null : (
            <OptionalDetail title="Advisory agent review">
              <AgentReviewPanel review={agentReview} />
            </OptionalDetail>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

function OptionalDetail({ children, title }: { readonly children: ReactNode; readonly title: string }) {
  return (
    <Accordion disableGutters elevation={0} sx={{ "&::before": { display: "none" }, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
      <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
        <Typography variant="subtitle2">{title}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pt: 0.5 }}>{children}</AccordionDetails>
    </Accordion>
  );
}
