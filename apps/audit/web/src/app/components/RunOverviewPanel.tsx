import { Chip, Paper, Stack, Typography } from "@mui/material";

import type { AuditRunDetail, AuditWorkItemTimeline } from "@taxes/shared";

import { summarizePlanningLink } from "../planning-link-presentation.js";
import { summarizeRunPresentation } from "../run-presentation.js";
import { formatDateTime, formatDuration, formatRelativePath } from "../time.js";
import { AuditPanel, DetailGrid } from "./AuditPanel.js";

interface RunOverviewPanelProps {
  readonly detail: AuditRunDetail;
  readonly timeline: AuditWorkItemTimeline | null;
}

export function RunOverviewPanel({ detail, timeline }: RunOverviewPanelProps) {
  const presentation = summarizeRunPresentation(detail.run);
  const planningLink = summarizePlanningLink(detail.run, timeline);
  const previewCount = presentation.trailingCount ?? 0;
  const detailItems = [
    { label: "Workflow", value: detail.run.workflow },
    { label: "Actor", value: detail.run.actor },
    { label: "Agent", value: detail.run.agentName ?? "Unassigned" },
    { label: "Project", value: detail.run.project ?? "Unassigned" },
    { label: "Work item", value: detail.run.workItemId ?? "Unassigned" },
    { label: "Plan run", value: detail.run.planRunId ?? "Unassigned" },
    { label: "Plan step", value: detail.run.planStepId ?? "Unassigned" },
    { label: "Session", value: detail.run.sessionId ?? "Unassigned" },
    { label: "Worktree", value: detail.run.worktreePath },
    { label: "Started", value: formatDateTime(detail.run.startedAt) },
    { label: "Completed", value: formatDateTime(detail.run.completedAt) },
    { label: "Duration", value: formatDuration(detail.run.durationMs) }
  ];

  return (
    <AuditPanel elevation={0}>
      <Stack spacing={1.5}>
        <RunOverviewHeader detail={detail} presentation={presentation} />
        <PlanningLinkCard detail={detail} planningLink={planningLink} timeline={timeline} />
        <RunOverviewPreview previewCount={previewCount} previewItems={presentation.previewItems} />
        <DetailGrid items={detailItems} />
      </Stack>
    </AuditPanel>
  );
}

function RunOverviewHeader({
  detail,
  presentation
}: {
  readonly detail: AuditRunDetail;
  readonly presentation: ReturnType<typeof summarizeRunPresentation>;
}) {
  return (
    <Stack
      alignItems={{ sm: "center", xs: "flex-start" }}
      direction={{ sm: "row", xs: "column" }}
      justifyContent="space-between"
      spacing={1}
    >
      <div>
        <Typography variant="h3">{presentation.title}</Typography>
        <Typography color="text.secondary" variant="body2">
          {detail.run.runId}
        </Typography>
        {presentation.secondaryText === undefined ? null : (
          <Typography color="text.secondary" sx={{ mt: 0.6 }} variant="body2">
            {presentation.secondaryText}
          </Typography>
        )}
      </div>
      <Stack direction="row" spacing={0.75} useFlexGap>
        <Chip label={detail.run.workflow} size="small" variant="outlined" />
        <Chip color={toChipColor(detail.run.status)} label={detail.run.status} />
      </Stack>
    </Stack>
  );
}

function RunOverviewPreview({ previewCount, previewItems }: { readonly previewCount: number; readonly previewItems: string[] }) {
  if (previewItems.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
      {previewItems.map((item) => (
        <Chip key={item} label={formatRelativePath(item)} size="small" variant="outlined" />
      ))}
      {previewCount === 0 ? null : <Chip label={`+${previewCount.toString()} more`} size="small" variant="outlined" />}
    </Stack>
  );
}

function PlanningLinkCard({
  detail,
  planningLink,
  timeline
}: {
  readonly detail: AuditRunDetail;
  readonly planningLink: ReturnType<typeof summarizePlanningLink>;
  readonly timeline: AuditWorkItemTimeline | null;
}) {
  const contextChips = buildPlanningContextChips(detail, timeline);

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid var(--mui-palette-divider)",
        borderRadius: "calc(var(--mui-shape-borderRadius) * 1.05)",
        p: 1.75
      }}
    >
      <Stack spacing={1.1}>
        <Stack
          alignItems={{ sm: "center", xs: "flex-start" }}
          direction={{ sm: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1}
        >
          <div>
            <Typography variant="body1">{planningLink.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.4 }} variant="body2">
              {planningLink.detail}
            </Typography>
          </div>
          <Chip
            color={detail.run.workItemId === undefined ? "default" : "primary"}
            label={detail.run.workItemId === undefined ? "No linked work item" : "Planning linked"}
            size="small"
            variant={detail.run.workItemId === undefined ? "outlined" : "filled"}
          />
        </Stack>
        <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
          {planningLink.metrics.map((metric) => (
            <Chip key={metric} label={metric} size="small" variant="outlined" />
          ))}
        </Stack>
        {contextChips.length === 0 ? null : (
          <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
            {contextChips.map((label) => (
              <Chip key={label} label={label} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function buildPlanningContextChips(detail: AuditRunDetail, timeline: AuditWorkItemTimeline | null): string[] {
  return [
    ...(detail.run.project === undefined ? [] : [`Project ${detail.run.project}`]),
    ...(detail.run.workItemId === undefined ? [] : [`Work item ${detail.run.workItemId}`]),
    ...(detail.run.planRunId === undefined ? [] : [`Plan run ${detail.run.planRunId}`]),
    ...(detail.run.planStepId === undefined ? [] : [`Plan step ${detail.run.planStepId}`]),
    ...(timeline?.summary.latestEventAt === undefined ? [] : [`Latest lineage event ${formatDateTime(timeline.summary.latestEventAt)}`])
  ];
}

function toChipColor(status: string): "default" | "error" | "success" | "warning" {
  switch (status) {
    case "failed":
      return "error";
    case "running":
      return "warning";
    case "skipped":
      return "default";
    case "success":
      return "success";
    default:
      return "default";
  }
}
