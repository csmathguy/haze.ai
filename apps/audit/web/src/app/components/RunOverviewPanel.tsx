import { Chip, Stack, Typography } from "@mui/material";

import type { AuditRunDetail } from "@taxes/shared";

import { summarizeRunPresentation } from "../run-presentation.js";
import { formatDateTime, formatDuration, formatRelativePath } from "../time.js";
import { AuditPanel, DetailGrid } from "./AuditPanel.js";

interface RunOverviewPanelProps {
  readonly detail: AuditRunDetail;
}

export function RunOverviewPanel({ detail }: RunOverviewPanelProps) {
  const presentation = summarizeRunPresentation(detail.run);
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
