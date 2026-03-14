import ArrowOutwardOutlinedIcon from "@mui/icons-material/ArrowOutwardOutlined";
import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewPullRequestSummary } from "@taxes/shared";

import { formatPullRequestState } from "../index.js";

interface PullRequestSummaryCardProps {
  readonly isSelected: boolean;
  readonly onSelect: (pullRequestNumber: number) => void;
  readonly pullRequest: CodeReviewPullRequestSummary;
}

export function PullRequestSummaryCard({ isSelected, onSelect, pullRequest }: PullRequestSummaryCardProps) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: isSelected ? alpha(theme.palette.secondary.main, 0.08) : theme.palette.background.paper,
        borderColor: isSelected ? alpha(theme.palette.secondary.main, 0.58) : alpha(theme.palette.divider, 0.9),
        borderLeftWidth: isSelected ? 6 : 1,
        borderWidth: 1,
        p: 1.75
      })}
      variant="outlined"
    >
      <Stack spacing={1.25}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="subtitle2">PR #{pullRequest.number.toString()}</Typography>
          <Chip label={formatPullRequestState(pullRequest.state, pullRequest.isDraft)} size="small" variant={isSelected ? "filled" : "outlined"} />
        </Stack>
        <Typography variant="h3">{pullRequest.title}</Typography>
        <Typography color="text.secondary" variant="body2">
          {pullRequest.author.name ?? pullRequest.author.login} · {pullRequest.headRefName} → {pullRequest.baseRefName}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {pullRequest.linkedPlan === undefined ? (
            <Chip color="warning" label="Needs plan link" size="small" variant="outlined" />
          ) : (
            <Chip label={pullRequest.linkedPlan.workItemId} size="small" variant="outlined" />
          )}
          <Chip label={new Date(pullRequest.updatedAt).toLocaleString()} size="small" variant="outlined" />
        </Stack>
        <Button
          color={isSelected ? "secondary" : "primary"}
          endIcon={<ArrowOutwardOutlinedIcon />}
          onClick={() => {
            onSelect(pullRequest.number);
          }}
          variant={isSelected ? "contained" : "outlined"}
        >
          {isSelected ? "Selected" : "Open detail"}
        </Button>
      </Stack>
    </Paper>
  );
}
