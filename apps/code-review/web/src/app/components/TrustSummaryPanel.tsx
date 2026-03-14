import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import PendingOutlinedIcon from "@mui/icons-material/PendingOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Chip, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { TrustSummary } from "../walkthrough.js";

interface TrustSummaryPanelProps {
  readonly summary: TrustSummary;
  readonly totalLaneCount: number;
}

export function TrustSummaryPanel({ summary, totalLaneCount }: TrustSummaryPanelProps) {
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
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <div>
            <Typography variant="subtitle2">Human Trust Gate</Typography>
            <Typography variant="h3">{summary.statusLabel}</Typography>
          </div>
          <Chip
            color={summary.statusTone}
            label={`${summary.confirmedLaneCount.toString()} of ${totalLaneCount.toString()} checkpoints cleared`}
            variant="outlined"
          />
        </Stack>

        <Stack spacing={0.8}>
          <Stack alignItems="center" direction="row" justifyContent="space-between">
            <Typography variant="body2">Review coverage</Typography>
            <Typography color="text.secondary" variant="body2">
              {completionPercent.toString()}%
            </Typography>
          </Stack>
          <LinearProgress color={summary.statusTone === "success" ? "success" : "secondary"} value={completionPercent} variant="determinate" />
        </Stack>

        <SummaryBlock items={summary.valueSummary} title="Value added" />

        <Stack spacing={1}>
          <Typography variant="subtitle2">Evidence checkpoints</Typography>
          {summary.evidenceCheckpoints.map((checkpoint) => (
            <CheckpointRow
              detail={checkpoint.detail}
              key={checkpoint.label}
              label={checkpoint.label}
              status={checkpoint.status}
            />
          ))}
        </Stack>

        <SummaryBlock
          items={
            summary.followUpQueue.length > 0
              ? summary.followUpQueue
              : ["No unresolved follow-up items are blocking a human decision in the current review session."]
          }
          title="Follow-up queue"
        />
      </Stack>
    </Paper>
  );
}

function CheckpointRow({
  detail,
  label,
  status
}: {
  readonly detail: string;
  readonly label: string;
  readonly status: TrustSummary["evidenceCheckpoints"][number]["status"];
}) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.72),
        p: 1.5
      })}
      variant="outlined"
    >
      <Stack alignItems="flex-start" direction="row" spacing={1.25}>
        <Chip
          color={toCheckpointChipColor(status)}
          icon={toCheckpointIcon(status)}
          label={label}
          size="small"
          variant="outlined"
        />
        <Typography sx={{ pt: 0.35 }} variant="body2">
          {detail}
        </Typography>
      </Stack>
    </Paper>
  );
}

function toCheckpointChipColor(status: TrustSummary["evidenceCheckpoints"][number]["status"]): "secondary" | "success" | "warning" {
  switch (status) {
    case "complete":
      return "success";
    case "attention":
      return "warning";
    case "pending":
      return "secondary";
  }
}

function toCheckpointIcon(status: TrustSummary["evidenceCheckpoints"][number]["status"]) {
  switch (status) {
    case "complete":
      return <CheckCircleOutlineOutlinedIcon />;
    case "attention":
      return <WarningAmberOutlinedIcon />;
    case "pending":
      return <PendingOutlinedIcon />;
  }
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
