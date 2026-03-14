import { Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewPullRequestSummary } from "@taxes/shared";

import { formatPullRequestState } from "../index.js";

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
            Click a row to open the trust-gate drawer. The queue stays focused on scan-friendly context while the drawer carries the full story.
          </Typography>
        </Stack>
        {pullRequests.length === 0 ? (
          <Typography color="text.secondary" sx={{ px: 2.25, pb: 2.25 }} variant="body2">
            No pull requests were returned for this repository.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>PR</TableCell>
                  <TableCell>Story</TableCell>
                  <TableCell>Planning</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pullRequests.map((pullRequest) => (
                  <PullRequestRow
                    isSelected={pullRequest.number === selectedPullRequestNumber}
                    key={pullRequest.number}
                    onSelect={onSelect}
                    pullRequest={pullRequest}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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

  return (
    <TableRow
      hover
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
      selected={isSelected}
      sx={(theme) => ({
        "& td": {
          borderColor: alpha(theme.palette.divider, 0.9)
        },
        backgroundColor: isSelected ? alpha(theme.palette.secondary.main, 0.08) : undefined,
        cursor: "pointer",
        verticalAlign: "top"
      })}
      tabIndex={0}
    >
      <TableCell sx={{ minWidth: 96 }}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">#{pullRequest.number.toString()}</Typography>
          <Typography color="text.secondary" variant="body2">
            {pullRequest.author.name ?? pullRequest.author.login}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell sx={{ minWidth: 320 }}>
        <Stack spacing={0.8}>
          <Typography fontWeight={700} variant="body2">
            {pullRequest.title}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {pullRequest.headRefName} -&gt; {pullRequest.baseRefName}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell sx={{ minWidth: 160 }}>
        {pullRequest.linkedPlan === undefined ? (
          <Chip color="warning" label="Needs plan link" size="small" variant="outlined" />
        ) : (
          <Chip label={pullRequest.linkedPlan.workItemId} size="small" variant="outlined" />
        )}
      </TableCell>
      <TableCell sx={{ minWidth: 128 }}>
        <Chip color={stateColor} label={formatPullRequestState(pullRequest.state, pullRequest.isDraft)} size="small" variant={isSelected ? "filled" : "outlined"} />
      </TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        <Typography color="text.secondary" variant="body2">
          {new Date(pullRequest.updatedAt).toLocaleString()}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

function resolveStateColor(pullRequest: CodeReviewPullRequestSummary): "default" | "success" | "warning" {
  if (pullRequest.isDraft) {
    return "warning";
  }

  return pullRequest.state === "OPEN" ? "success" : "default";
}
