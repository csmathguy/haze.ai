import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import type { CodeReviewPullRequestDetail } from "@taxes/shared";

import { buildPullRequestStory } from "../pull-request-story.js";
import { buildReviewOverviewPresentation } from "../review-presentation.js";

interface PullRequestOverviewPanelProps {
  readonly pullRequest: CodeReviewPullRequestDetail;
}

export function PullRequestOverviewPanel({ pullRequest }: PullRequestOverviewPanelProps) {
  const story = buildPullRequestStory(pullRequest);
  const presentation = buildReviewOverviewPresentation(pullRequest);

  return (
    <Paper sx={{ p: 3 }} variant="outlined">
      <Stack spacing={2}>
        <OverviewHeader pullRequest={pullRequest} />
        <OverviewSignals chips={presentation.metaChips} />
        <OverviewWarnings pullRequest={pullRequest} />
        <Grid container spacing={2.25}>
          <Grid size={{ lg: 8, xs: 12 }}>
            <HeroBrief presentation={presentation} />
          </Grid>
          <Grid size={{ lg: 4, xs: 12 }}>
            <ActionBrief actions={presentation.primaryActions} />
          </Grid>
          {presentation.detailSections.map((section) => (
            <Grid key={section.title} size={{ md: 4, xs: 12 }}>
              <DetailCard items={section.items} title={section.title} />
            </Grid>
          ))}
          <Grid size={{ md: 6, xs: 12 }}>
            <DetailCard items={story.reviewQuestions} title="Reviewer Focus" />
          </Grid>
          <Grid size={{ md: 6, xs: 12 }}>
            <DetailCard items={buildAuditEvidence(pullRequest)} title="Audit Evidence" />
          </Grid>
        </Grid>
        <ValidationAccordion pullRequest={pullRequest} validationCommands={story.validationCommands} validationOverview={story.validationOverview} />
      </Stack>
    </Paper>
  );
}

function OverviewHeader({ pullRequest }: PullRequestOverviewPanelProps) {
  const presentation = buildReviewOverviewPresentation(pullRequest);

  return (
    <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">{presentation.heroEyebrow}</Typography>
        <Typography variant="h2">Why This Matters</Typography>
        <Typography variant="h3">{presentation.heroTitle}</Typography>
        <Typography color="text.secondary" variant="body2">
          {pullRequest.author.name ?? pullRequest.author.login} | {pullRequest.headRefName} -&gt; {pullRequest.baseRefName}
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
  );
}

function OverviewSignals({ chips }: { readonly chips: string[] }) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {chips.map((chip) => (
        <Chip key={chip} label={chip} size="small" variant="outlined" />
      ))}
    </Stack>
  );
}

function OverviewWarnings({ pullRequest }: PullRequestOverviewPanelProps) {
  const warnings = [
    ...(pullRequest.linkedPlan === undefined
      ? ["Add a PLAN reference in the branch name or PR body so the review stays anchored to planning and audit lineage."]
      : []),
    ...(pullRequest.evidenceWarnings ?? [])
  ];

  if (warnings.length === 0) {
    return null;
  }

  return (
    <Alert severity="warning">
      <Stack spacing={0.5}>
        {warnings.map((warning) => (
          <Typography key={warning} variant="body2">
            {warning}
          </Typography>
        ))}
      </Stack>
    </Alert>
  );
}

function HeroBrief({
  presentation
}: {
  readonly presentation: ReturnType<typeof buildReviewOverviewPresentation>;
}) {
  return (
    <Paper
      sx={(theme) => ({
        background: `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.08)}, ${alpha(theme.palette.background.paper, 0.94)})`,
        p: 2
      })}
      variant="outlined"
    >
      <Stack spacing={1.2}>
        <Typography variant="subtitle2">Review Brief</Typography>
        {presentation.heroSummary.map((item) => (
          <Typography key={item} variant="body2">
            {item}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function ActionBrief({
  actions
}: {
  readonly actions: readonly ReturnType<typeof buildReviewOverviewPresentation>["primaryActions"][number][];
}) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.76),
        p: 2
      })}
      variant="outlined"
    >
      <Stack spacing={1.1}>
        <Typography variant="subtitle2">How To Review This PR</Typography>
        {actions.map((action) => (
          <Stack key={action.title} spacing={0.35}>
            <Typography variant="body2">{action.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {action.description}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function DetailCard({ items, title }: { readonly items: string[]; readonly title: string }) {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: alpha(theme.palette.background.default, 0.76),
        p: 2
      })}
      variant="outlined"
    >
      <Stack spacing={1.1}>
        <Typography variant="subtitle2">{title}</Typography>
        {items.map((item) => (
          <Typography key={`${title}-${item}`} variant="body2">
            {item}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function ValidationAccordion({
  pullRequest,
  validationCommands,
  validationOverview
}: {
  readonly pullRequest: CodeReviewPullRequestDetail;
  readonly validationCommands: string[];
  readonly validationOverview: string[];
}) {
  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreOutlinedIcon />}>
        <Stack spacing={0.4}>
          <Typography variant="subtitle2">Raw validation detail</Typography>
          <Typography color="text.secondary" variant="body2">
            {validationOverview.join(" | ")}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.1}>
          {validationCommands.length === 0 ? (
            <Typography variant="body2">No explicit validation commands were attached to the PR narrative.</Typography>
          ) : (
            validationCommands.map((command) => (
              <Typography key={command} sx={{ fontFamily: "var(--mui-fontFamily-monospace, monospace)" }} variant="body2">
                {command}
              </Typography>
            ))
          )}
          {pullRequest.checks.map((check, index) => (
            <Typography key={buildValidationCheckKey(check, index)} color="text.secondary" variant="body2">
              {check.workflowName ?? check.name}: {check.conclusion?.toLowerCase() ?? check.status.toLowerCase()}
            </Typography>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function buildValidationCheckKey(check: CodeReviewPullRequestDetail["checks"][number], index: number): string {
  return [
    check.workflowName ?? "workflow",
    check.name,
    check.status,
    check.conclusion ?? "no-conclusion",
    check.detailsUrl ?? check.startedAt ?? check.completedAt ?? `row-${index.toString()}`
  ].join(":");
}

function buildAuditEvidence(pullRequest: CodeReviewPullRequestDetail): string[] {
  if (pullRequest.auditEvidence === undefined) {
    return [
      pullRequest.linkedPlan === undefined
        ? "Audit lineage appears after the pull request is tied back to a planning work item."
        : `No audit evidence is currently materialized for ${pullRequest.linkedPlan.workItemId}.`
    ];
  }

  return [
    `${pullRequest.auditEvidence.runCount.toString()} linked audit runs`,
    `${pullRequest.auditEvidence.failureCount.toString()} recorded failures`,
    `${pullRequest.auditEvidence.handoffCount.toString()} recorded handoffs`,
    `Active agents: ${pullRequest.auditEvidence.activeAgents.join(", ") || "none recorded"}`,
    ...(pullRequest.auditEvidence.recentRuns[0] === undefined
      ? []
      : [`Latest run: ${pullRequest.auditEvidence.recentRuns[0].workflow} (${pullRequest.auditEvidence.recentRuns[0].status})`])
  ];
}
