import { Alert, Button, Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { FollowUpActionTone } from "../use-follow-up-action.js";
import type { TrustSummary } from "../walkthrough.js";

interface TrustSummaryPanelProps {
  readonly canCreateFollowUp?: boolean;
  readonly followUpActionMessage?: string | null;
  readonly followUpActionTone?: FollowUpActionTone;
  readonly isCreatingFollowUp?: boolean;
  readonly onCreateFollowUp?: (() => void) | undefined;
  readonly summary: TrustSummary;
  readonly totalLaneCount: number;
}

export function TrustSummaryPanel({
  canCreateFollowUp = true,
  followUpActionMessage = null,
  followUpActionTone = "info",
  isCreatingFollowUp = false,
  onCreateFollowUp,
  summary,
  totalLaneCount
}: TrustSummaryPanelProps) {
  const completionPercent = totalLaneCount === 0 ? 0 : Math.round((summary.confirmedLaneCount / totalLaneCount) * 100);

  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.paper, 0.94),
        p: 2.5
      })}
      variant="outlined"
    >
      <Stack spacing={2.25}>
        <TrustSummaryHeader summary={summary} totalLaneCount={totalLaneCount} />

        <Stack spacing={0.8}>
          <Stack alignItems="center" direction="row" justifyContent="space-between">
            <Typography variant="body2">Review coverage</Typography>
            <Typography color="text.secondary" variant="body2">
              {completionPercent.toString()}%
            </Typography>
          </Stack>
          <LinearProgress color={summary.statusTone === "success" ? "success" : "secondary"} value={completionPercent} variant="determinate" />
        </Stack>

        <DecisionCallout summary={summary} />
        <SummaryBlock items={summary.valueSummary.slice(0, 2)} title="Why this looks ready or blocked" />
        <SummaryBlock
          items={
            summary.followUpQueue.length > 0
              ? summary.followUpQueue
              : ["No unresolved follow-up items are blocking the current human decision."]
          }
          title="What still needs action"
        />
        <FollowUpActionArea
          canCreateFollowUp={canCreateFollowUp}
          followUpActionMessage={followUpActionMessage}
          followUpActionTone={followUpActionTone}
          isCreatingFollowUp={isCreatingFollowUp}
          onCreateFollowUp={onCreateFollowUp}
        />
      </Stack>
    </Paper>
  );
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
        <Typography variant="h3">{summary.statusLabel}</Typography>
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
      <Button disabled={isCreatingFollowUp || !canCreateFollowUp} onClick={onCreateFollowUp} variant="contained">
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
            ? "The walkthrough is covered. If the diff also looks correct, finish in GitHub or record any follow-up work before closing the review."
            : pendingCheckpoint.detail}
        </Typography>
      </Stack>
    </Paper>
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
