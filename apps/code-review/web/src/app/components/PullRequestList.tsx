import { Paper, Stack, Typography } from "@mui/material";

import type { CodeReviewPullRequestSummary } from "@taxes/shared";

import { PullRequestSummaryCard } from "./PullRequestSummaryCard.js";

interface PullRequestListProps {
  readonly onSelect: (pullRequestNumber: number) => void;
  readonly pullRequests: CodeReviewPullRequestSummary[];
  readonly selectedPullRequestNumber: number | null;
}

export function PullRequestList({ onSelect, pullRequests, selectedPullRequestNumber }: PullRequestListProps) {
  return (
    <Paper sx={{ p: 2.25 }} variant="outlined">
      <Stack spacing={1.5}>
        <div>
          <Typography variant="subtitle2">Pull Requests</Typography>
          <Typography variant="h3">Review queue</Typography>
        </div>
        {pullRequests.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No pull requests were returned for this repository.
          </Typography>
        ) : (
          pullRequests.map((pullRequest) => (
            <PullRequestSummaryCard
              key={pullRequest.number}
              isSelected={pullRequest.number === selectedPullRequestNumber}
              onSelect={onSelect}
              pullRequest={pullRequest}
            />
          ))
        )}
      </Stack>
    </Paper>
  );
}
