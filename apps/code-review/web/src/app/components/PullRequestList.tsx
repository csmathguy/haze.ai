import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import { Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewPullRequestSummary } from "@taxes/shared";

import { formatPullRequestNextAction, formatPullRequestState, formatPullRequestStatusDetail } from "../index.js";

interface PullRequestListProps {
  readonly onSelect: (pullRequestNumber: number) => void;
  readonly pullRequests: CodeReviewPullRequestSummary[];
  readonly selectedPullRequestNumber: number | null;
}

export function PullRequestList({ onSelect, pullRequests, selectedPullRequestNumber }: PullRequestListProps) {
  return (
    <Paper sx={{ overflow: "hidden", p: 0 }} variant="outlined">
      <Stack spacing={0}>
        <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={1.5} sx={{ px: 2.25, py: 2 }}>
          <div>
            <Typography variant="subtitle2">Pull Requests</Typography>
            <Typography variant="h3">Review queue</Typography>
          </div>
          <Typography color="text.secondary" maxWidth={480} variant="body2">
            Pick the next PR to review. Each row tells you what it is, where it stands, and whether you should open it now.
          </Typography>
        </Stack>
        {pullRequests.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.25, pb: 2.25 }} variant="body2">
            No pull requests were returned for this repository.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {pullRequests.map((pullRequest) => (
              <PullRequestRow
                isSelected={pullRequest.number === selectedPullRequestNumber}
                key={pullRequest.number}
                onSelect={onSelect}
                pullRequest={pullRequest}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function PullRequestRow({
  isSelected,
  onSelect,
  pullRequest
}: {
  readonly isSelected: boolean;
  readonly onSelect: (pullRequestNumber: number) => void;
  readonly pullRequest: CodeReviewPullRequestSummary;
}) {
  const stateColor = resolveStateColor(pullRequest);
  const updatedLabel = new Date(pullRequest.updatedAt).toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  });

  return (
    <Stack
      onClick={() => {
        onSelect(pullRequest.number);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(pullRequest.number);
        }
      }}
      role="button"
      sx={(theme) => ({
        backgroundColor: isSelected ? alpha(theme.palette.secondary.main, 0.08) : undefined,
        borderLeft: isSelected ? `3px solid ${theme.palette.secondary.main}` : "3px solid transparent",
        cursor: "pointer",
        px: 2.25,
        py: 1.75
      })}
      tabIndex={0}
    >
      <Stack spacing={1}>
        <Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography fontWeight={700} variant="body2">
              #{pullRequest.number.toString()} {pullRequest.title}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {pullRequest.author.name ?? pullRequest.author.login} | {pullRequest.headRefName} -&gt; {pullRequest.baseRefName}
            </Typography>
          </Stack>
          <ChevronRightOutlinedIcon color={isSelected ? "secondary" : "action"} fontSize="small" sx={{ mt: 0.25 }} />
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={1}>
          {pullRequest.linkedPlan === undefined ? (
            <Chip color="warning" label="Needs plan link" size="small" variant="outlined" />
          ) : (
            <Chip label={pullRequest.linkedPlan.workItemId} size="small" variant="outlined" />
          )}
          <Chip
            color={stateColor}
            label={formatPullRequestState(pullRequest.state, pullRequest.isDraft)}
            size="small"
            variant={isSelected ? "filled" : "outlined"}
          />
          <Chip label={`Updated ${updatedLabel}`} size="small" variant="outlined" />
        </Stack>

        <Stack spacing={0.35}>
          <Typography variant="body2">{formatPullRequestNextAction(pullRequest.state, pullRequest.isDraft)}</Typography>
          <Typography color="text.secondary" variant="body2">
            {formatPullRequestStatusDetail(pullRequest.state, pullRequest.isDraft)}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}

function resolveStateColor(pullRequest: CodeReviewPullRequestSummary): "default" | "success" | "warning" {
  if (pullRequest.isDraft) {
    return "warning";
  }

  return pullRequest.state === "OPEN" ? "success" : "default";
}
