import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";

import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildReviewOverviewPresentation } from "../review-presentation.js";
import { PullRequestOverviewPanel } from "./PullRequestOverviewPanel.js";

interface ReviewStartPanelProps {
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly stageTitle: string;
}

export function ReviewStartPanel({ pullRequest, stageTitle }: ReviewStartPanelProps) {
  const presentation = buildReviewOverviewPresentation(pullRequest);

  return (
    <Paper sx={{ p: 2.5 }} variant="outlined">
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Start Here</Typography>
          <Typography variant="h3">{presentation.heroTitle}</Typography>
          <Typography color="text.secondary" variant="body2">
            Begin with the current step below. You do not need to understand the whole PR at once.
          </Typography>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip label={`Current step: ${stageTitle}`} size="small" variant="outlined" />
          <Chip label="Start with context, then move one checkpoint at a time" size="small" variant="outlined" />
          {pullRequest.linkedPlan === undefined ? <Chip color="warning" label="Plan link missing" size="small" variant="outlined" /> : null}
        </Stack>

        <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
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

        {pullRequest.linkedPlan === undefined ? (
          <Alert severity="warning">This review is easier to trust when the PR is linked back to a planning work item.</Alert>
        ) : null}

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
            <Stack spacing={0.25}>
              <Typography variant="subtitle2">Review Background</Typography>
              <Typography color="text.secondary" variant="body2">
                Open this only if you need the broader PR summary before starting the walkthrough.
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pb: 0 }}>
            <PullRequestOverviewPanel pullRequest={pullRequest} />
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Paper>
  );
}
