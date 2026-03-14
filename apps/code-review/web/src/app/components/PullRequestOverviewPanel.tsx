import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Button, Chip, Divider, Grid, Paper, Stack, Typography } from "@mui/material";

import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { formatPullRequestState } from "../index.js";

interface PullRequestOverviewPanelProps {
  readonly pullRequest: CodeReviewPullRequestDetail;
}

export function PullRequestOverviewPanel({ pullRequest }: PullRequestOverviewPanelProps) {
  return (
    <Paper sx={{ p: 3 }} variant="outlined">
      <Stack spacing={2}>
        <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">
              PR #{pullRequest.number.toString()} · {formatPullRequestState(pullRequest.state, pullRequest.isDraft)}
            </Typography>
            <Typography variant="h2">{pullRequest.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {pullRequest.author.name ?? pullRequest.author.login} · {pullRequest.headRefName} → {pullRequest.baseRefName}
            </Typography>
          </Stack>
          <Stack alignItems={{ md: "flex-end", xs: "flex-start" }} spacing={1}>
            <Button component="a" endIcon={<OpenInNewOutlinedIcon />} href={pullRequest.url} rel="noreferrer" target="_blank" variant="outlined">
              Open on GitHub
            </Button>
            {pullRequest.linkedPlan === undefined ? null : (
              <Button
                component="a"
                endIcon={<OpenInNewOutlinedIcon />}
                href={pullRequest.linkedPlan.url}
                rel="noreferrer"
                target="_blank"
                variant="outlined"
              >
                Open {pullRequest.linkedPlan.workItemId}
              </Button>
            )}
          </Stack>
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip label={`${pullRequest.stats.fileCount.toString()} files`} size="small" variant="outlined" />
          <Chip label={`+${pullRequest.stats.totalAdditions.toString()} / -${pullRequest.stats.totalDeletions.toString()}`} size="small" variant="outlined" />
          <Chip label={`${pullRequest.checks.length.toString()} checks`} size="small" variant="outlined" />
          <Chip label={`merge state: ${pullRequest.mergeStateStatus.toLowerCase()}`} size="small" variant="outlined" />
        </Stack>
        <Typography color="text.secondary" variant="body1">
          {pullRequest.trustStatement}
        </Typography>
        <Divider />
        <Grid container spacing={2}>
          <Grid size={{ md: 6, xs: 12 }}>
            <NarrativeBlock items={pullRequest.narrative.summaryBullets} title="Purpose and value" />
          </Grid>
          <Grid size={{ md: 6, xs: 12 }}>
            <NarrativeBlock items={pullRequest.narrative.reviewFocus} title="Review focus" />
          </Grid>
          <Grid size={{ md: 6, xs: 12 }}>
            <NarrativeBlock items={pullRequest.narrative.risks} title="Risks" />
          </Grid>
          <Grid size={{ md: 6, xs: 12 }}>
            <NarrativeBlock
              items={pullRequest.narrative.validationCommands.length > 0 ? pullRequest.narrative.validationCommands : ["No explicit commands were listed in the PR body."]}
              title="Validation commands"
            />
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  );
}

function NarrativeBlock({ items, title }: { readonly items: string[]; readonly title: string }) {
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
