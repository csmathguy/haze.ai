import { Alert, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CodeReviewReviewAction } from "@taxes/shared";

import type { FollowUpActionTone } from "../use-follow-up-action.js";
import type { ReviewActionTone } from "../use-review-action.js";
import type { TrustSummary } from "../walkthrough.js";

interface TrustSummaryPanelProps {
  readonly canCreateFollowUp?: boolean;
  readonly followUpActionMessage?: string | null;
  readonly followUpActionTone?: FollowUpActionTone;
  readonly isCreatingFollowUp?: boolean;
  readonly isSubmittingReviewAction?: boolean;
  readonly onCreateFollowUp?: (() => void) | undefined;
  readonly onSubmitReviewAction?: ((action: CodeReviewReviewAction) => void) | undefined;
  readonly reviewActionMessage?: string | null;
  readonly reviewActionTone?: ReviewActionTone;
  readonly summary: TrustSummary;
  readonly totalLaneCount: number;
}

export function TrustSummaryPanel({
  canCreateFollowUp = true,
  followUpActionMessage = null,
  followUpActionTone = "info",
  isCreatingFollowUp = false,
  isSubmittingReviewAction = false,
  onCreateFollowUp,
  onSubmitReviewAction,
  reviewActionMessage = null,
  reviewActionTone = "info",
  summary,
  totalLaneCount
}: TrustSummaryPanelProps) {
  const completionPercent = totalLaneCount === 0 ? 0 : Math.round((summary.confirmedLaneCount / totalLaneCount) * 100);
  const followUpItems = getFollowUpItems(summary);
  const progressTone = getProgressTone(summary);

  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.paper, 0.94),
        p: 2
      })}
      variant="outlined"
    >
      <Stack spacing={1.75}>
        <TrustSummaryHeader summary={summary} totalLaneCount={totalLaneCount} />

        <Stack spacing={0.8}>
          <Stack alignItems="center" direction="row" justifyContent="space-between">
            <Typography variant="body2">Review coverage</Typography>
            <Typography color="text.secondary" variant="body2">
              {completionPercent.toString()}%
            </Typography>
          </Stack>
          <LinearProgress color={progressTone} value={completionPercent} variant="determinate" />
        </Stack>

        <DecisionCallout summary={summary} />
        <SummaryBlock items={summary.valueSummary.slice(0, 2)} title="Why this looks ready or blocked" />
        <SummaryBlock items={followUpItems} title="What still needs action" />
        <FollowUpActionArea
          canCreateFollowUp={canCreateFollowUp}
          followUpActionMessage={followUpActionMessage}
          followUpActionTone={followUpActionTone}
          isCreatingFollowUp={isCreatingFollowUp}
          onCreateFollowUp={onCreateFollowUp}
        />
        <GitHubActionArea
          isSubmittingReviewAction={isSubmittingReviewAction}
          onSubmitReviewAction={onSubmitReviewAction}
          reviewActionMessage={reviewActionMessage}
          reviewActionTone={reviewActionTone}
        />
      </Stack>
    </Paper>
  );
}

function getFollowUpItems(summary: TrustSummary): string[] {
  return summary.followUpQueue.length > 0
    ? summary.followUpQueue
    : ["No unresolved follow-up items are blocking the current human decision."];
}

function getProgressTone(summary: TrustSummary): "secondary" | "success" {
  return summary.statusTone === "success" ? "success" : "secondary";
}

function TrustSummaryHeader({
  summary,
  totalLaneCount
}: {
  readonly summary: TrustSummary;
  readonly totalLaneCount: number;
}) {
  return (
    <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
      <div>
        <Typography variant="subtitle2">Final Decision</Typography>
        <Typography variant="h6">{summary.statusLabel}</Typography>
      </div>
      <Chip
        color={summary.statusTone}
        label={`${summary.confirmedLaneCount.toString()} of ${totalLaneCount.toString()} checkpoints cleared`}
        variant="outlined"
      />
    </Stack>
  );
}

function FollowUpActionArea({
  canCreateFollowUp,
  followUpActionMessage,
  followUpActionTone,
  isCreatingFollowUp,
  onCreateFollowUp
}: {
  readonly canCreateFollowUp: boolean;
  readonly followUpActionMessage: string | null;
  readonly followUpActionTone: FollowUpActionTone;
  readonly isCreatingFollowUp: boolean;
  readonly onCreateFollowUp?: (() => void) | undefined;
}) {
  if (onCreateFollowUp === undefined) {
    return followUpActionMessage === null ? null : <Alert severity={followUpActionTone}>{followUpActionMessage}</Alert>;
  }

  return (
    <>
      {followUpActionMessage === null ? null : <Alert severity={followUpActionTone}>{followUpActionMessage}</Alert>}
      <Button disabled={isCreatingFollowUp || !canCreateFollowUp} onClick={onCreateFollowUp} size="small" variant="outlined">
        {isCreatingFollowUp ? "Creating follow-up..." : "Create follow-up work item"}
      </Button>
      {canCreateFollowUp ? null : (
        <Typography color="text.secondary" variant="body2">
          Capture at least one follow-up candidate above before creating a planning item.
        </Typography>
      )}
    </>
  );
}

function DecisionCallout({ summary }: { readonly summary: TrustSummary }) {
  const pendingCheckpoint = summary.evidenceCheckpoints.find((checkpoint) => checkpoint.status !== "complete");

  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.72),
        p: 1.5
      })}
      variant="outlined"
    >
      <Stack spacing={0.75}>
        <Typography variant="subtitle2">What to do next</Typography>
        <Typography variant="body2">
          {pendingCheckpoint === undefined
            ? "The walkthrough is covered. Send the GitHub review action below or capture any follow-up work before closing the review."
            : pendingCheckpoint.detail}
        </Typography>
      </Stack>
    </Paper>
  );
}

function GitHubActionArea({
  isSubmittingReviewAction,
  onSubmitReviewAction,
  reviewActionMessage,
  reviewActionTone
}: {
  readonly isSubmittingReviewAction: boolean;
  readonly onSubmitReviewAction?: ((action: CodeReviewReviewAction) => void) | undefined;
  readonly reviewActionMessage: string | null;
  readonly reviewActionTone: ReviewActionTone;
}) {
  if (onSubmitReviewAction === undefined) {
    return reviewActionMessage === null ? null : <Alert severity={reviewActionTone}>{reviewActionMessage}</Alert>;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Send decision to GitHub</Typography>
      {reviewActionMessage === null ? null : <Alert severity={reviewActionTone}>{reviewActionMessage}</Alert>}
      <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
        <Button
          disabled={isSubmittingReviewAction}
          onClick={() => {
            onSubmitReviewAction("approve");
          }}
          size="small"
          variant="outlined"
        >
          {isSubmittingReviewAction ? "Submitting..." : "Approve in GitHub"}
        </Button>
        <Button
          color="success"
          disabled={isSubmittingReviewAction}
          onClick={() => {
            onSubmitReviewAction("merge");
          }}
          size="small"
          variant="outlined"
        >
          {isSubmittingReviewAction ? "Submitting..." : "Merge via GitHub"}
        </Button>
        <Button
          color="inherit"
          disabled={isSubmittingReviewAction}
          onClick={() => {
            onSubmitReviewAction("request-changes");
          }}
          size="small"
          variant="outlined"
        >
          Request changes
        </Button>
      </Stack>
      <Typography color="text.secondary" variant="body2">
        GitHub remains the source of truth. This app sends the review action and records the local workflow event.
      </Typography>
    </Stack>
  );
}

function SummaryBlock({ items, title }: { readonly items: string[]; readonly title: string }) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{title}</Typography>
      {items.map((item) => (
        <Typography key={item} variant="body2">
          {item}
        </Typography>
      ))}
    </Stack>
  );
}
