import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { TrustSummary } from "../walkthrough.js";

interface TrustSummaryPanelProps {
  readonly summary: TrustSummary;
  readonly totalLaneCount: number;
}

export function TrustSummaryPanel({ summary, totalLaneCount }: TrustSummaryPanelProps) {
  const chipColor = resolveConfidenceChipColor(summary.confidenceLabel);
  const chipIcon = summary.confidenceLabel === "High confidence" ? <VerifiedOutlinedIcon /> : <WarningAmberOutlinedIcon />;

  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.paper, 0.94),
        p: 2.5
      })}
      variant="outlined"
    >
      <Stack spacing={2}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <div>
            <Typography variant="subtitle2">Trust Summary</Typography>
            <Typography variant="h3">{summary.confidenceLabel}</Typography>
          </div>
          <Chip
            color={chipColor}
            icon={chipIcon}
            label={`${summary.confirmedLaneCount.toString()} of ${totalLaneCount.toString()} checkpoints confirmed`}
            variant="outlined"
          />
        </Stack>

        <SummaryBlock items={summary.valueSummary} title="Value Added" />
        <SummaryBlock
          items={summary.remainingRisk.length > 0 ? summary.remainingRisk : ["No unresolved follow-up items were recorded in the notebook."]}
          title="Remaining Risk"
        />
      </Stack>
    </Paper>
  );
}

function resolveConfidenceChipColor(confidenceLabel: TrustSummary["confidenceLabel"]): "secondary" | "success" | "warning" {
  if (confidenceLabel === "High confidence") {
    return "success";
  }

  if (confidenceLabel === "Needs follow-up") {
    return "warning";
  }

  return "secondary";
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
