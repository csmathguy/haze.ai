import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import type { ReactNode } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildReviewBriefPresentation } from "../review-brief-presentation.js";

interface ReviewStartPanelProps {
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly stageTitle: string;
}

export function ReviewStartPanel({ pullRequest, stageTitle }: ReviewStartPanelProps) {
  const presentation = buildReviewBriefPresentation(pullRequest, stageTitle);

  return (
    <Paper
      sx={(theme) => ({
        background: `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.06)}, ${theme.palette.background.paper})`,
        p: 2
      })}
      variant="outlined"
    >
      <Stack spacing={1.5}>
        <StartHeader presentation={presentation} />
        <ReviewGoalCard presentation={presentation} />

        {presentation.checklistSections.length === 0 ? null : (
          <Stack spacing={1}>
            {presentation.checklistSections.map((section) => (
              <ChecklistSection key={section.title} items={section.items} title={section.title} />
            ))}
          </Stack>
        )}

        <StartActions pullRequest={pullRequest} />

        {pullRequest.linkedPlan === undefined ? (
          <Alert severity="warning">Link this PR to a planning work item before final approval so the reviewer can verify intent.</Alert>
        ) : null}

        <OptionalSection
          description="Only open this if you need more context before moving into the walkthrough."
          title="Need more context?"
        >
          <Stack spacing={1.25}>
            <BulletSection items={presentation.whatThisPrDoes} title="What this PR does" />
            <BulletSection items={presentation.inspectFirst} title="Inspect first" />
            {presentation.missingEvidence.length > 0 ? <BulletSection items={presentation.missingEvidence} title="Missing evidence" /> : null}
          </Stack>
        </OptionalSection>
      </Stack>
    </Paper>
  );
}

function StartHeader({ presentation }: { readonly presentation: ReturnType<typeof buildReviewBriefPresentation> }) {
  return (
    <Stack spacing={1}>
      <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Step 1: Understand the work item</Typography>
          <Typography variant="h5">{presentation.title}</Typography>
        </Stack>
        <Chip label={presentation.workItemLabel} size="small" variant="outlined" />
      </Stack>
      <Typography color="text.secondary" variant="body2">
        {presentation.summary}
      </Typography>
      <CompactList items={presentation.compactStatus} />
    </Stack>
  );
}

function ReviewGoalCard({ presentation }: { readonly presentation: ReturnType<typeof buildReviewBriefPresentation> }) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.7),
        p: 1.5
      })}
      variant="outlined"
    >
      <Stack spacing={1.25}>
        <Typography variant="subtitle2">What you are confirming</Typography>
        <Typography variant="body2">{presentation.reviewGoal}</Typography>
        <CompactNumberedList items={presentation.startHere} />
        <Typography color="text.secondary" variant="body2">
          Current checkpoint: {presentation.nextStepTitle}
        </Typography>
      </Stack>
    </Paper>
  );
}

function StartActions({ pullRequest }: { readonly pullRequest: CodeReviewPullRequestDetail }) {
  return (
    <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
      <Button component="a" endIcon={<OpenInNewOutlinedIcon />} href={pullRequest.url} rel="noreferrer" size="small" target="_blank" variant="contained">
        Open PR on GitHub
      </Button>
      {pullRequest.linkedPlan === undefined ? null : (
        <Button
          component="a"
          endIcon={<OpenInNewOutlinedIcon />}
          href={pullRequest.linkedPlan.url}
          rel="noreferrer"
          size="small"
          target="_blank"
          variant="outlined"
        >
          Open {pullRequest.linkedPlan.workItemId}
        </Button>
      )}
    </Stack>
  );
}

function OptionalSection({
  children,
  description,
  title
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly title: string;
}) {
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
        <Stack spacing={0.25}>
          <Typography variant="subtitle2">{title}</Typography>
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

function BulletSection({ items, title }: { readonly items: string[]; readonly title: string }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2">{title}</Typography>
      <CompactList items={items} />
    </Stack>
  );
}

function ChecklistSection({ items, title }: { readonly items: string[]; readonly title: string }) {
  return (
    <Paper sx={{ p: 1.5 }} variant="outlined">
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{title}</Typography>
        <CompactList items={items} />
      </Stack>
    </Paper>
  );
}

function CompactList({ items }: { readonly items: string[] }) {
  return (
    <Stack spacing={0.35}>
      {items.map((item) => (
        <Typography key={item} color="text.secondary" variant="body2">
          {item}
        </Typography>
      ))}
    </Stack>
  );
}

function CompactNumberedList({ items }: { readonly items: string[] }) {
  return (
    <Stack spacing={0.35}>
      {items.map((item, index) => (
        <Typography key={item} variant="body2">
          {(index + 1).toString()}. {item}
        </Typography>
      ))}
    </Stack>
  );
}
