import { Chip, Divider, List, ListItemButton, Paper, Stack, Typography } from "@mui/material";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import RuleFolderOutlinedIcon from "@mui/icons-material/RuleFolderOutlined";
import { alpha, styled } from "@mui/material/styles";

import type { AuditRunOverview } from "@taxes/shared";

import { summarizeRunPresentation } from "../run-presentation.js";
import { formatDateTime, formatDuration, formatRelativePath } from "../time.js";

interface RunListProps {
  readonly onSelect: (runId: string) => void;
  readonly runs: AuditRunOverview[];
  readonly selectedRunId: string | null;
}

const ListShell = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: Number(theme.shape.borderRadius) * 1.15,
  overflow: "hidden"
}));

const RunCardButton = styled(ListItemButton)(({ theme }) => ({
  "&.Mui-selected": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.1)
  },
  "&.Mui-selected:hover": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.16)
  },
  alignItems: "stretch",
  borderBottom: "1px solid var(--mui-palette-divider)",
  padding: theme.spacing(2.25)
}));

const CardSurface = styled("article")(({ theme }) => ({
  background: `
    linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.4)} 0%, transparent 100%),
    color-mix(in srgb, var(--mui-palette-background-paper) 92%, var(--mui-palette-secondary-main) 8%)
  `,
  border: `1px solid ${alpha(theme.palette.secondary.main, 0.12)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.05,
  padding: theme.spacing(2),
  width: "100%"
}));

const PreviewChip = styled(Chip)(() => ({
  justifyContent: "flex-start",
  maxWidth: "100%"
}));

export function RunList({ onSelect, runs, selectedRunId }: RunListProps) {
  return (
    <ListShell elevation={0}>
      <Stack spacing={0}>
        <Stack direction="row" justifyContent="space-between" px={2.5} py={2}>
          <div>
            <Typography variant="h3">Recent runs</Typography>
            <Typography color="text.secondary" variant="body2">
              Select a run to inspect its event flow, failure analysis, and linked plan or work-item context.
            </Typography>
          </div>
          <Chip label={`${runs.length.toString()} loaded`} variant="outlined" />
        </Stack>
        <Divider />
        <List disablePadding>
          {runs.length === 0 ? (
            <Stack minHeight={220} px={2.5} py={3} spacing={1}>
              <Typography variant="body1">No runs match the current filters.</Typography>
              <Typography color="text.secondary" variant="body2">
                Start a workflow or clear one of the filters above.
              </Typography>
            </Stack>
          ) : (
            runs.map((run, index) => (
              <RunCardButton
                key={run.runId}
                onClick={() => {
                  onSelect(run.runId);
                }}
                selected={run.runId === selectedRunId}
                sx={index === runs.length - 1 ? { borderBottom: "none" } : undefined}
              >
                <RunCard run={run} />
              </RunCardButton>
            ))
          )}
        </List>
      </Stack>
    </ListShell>
  );
}

function RunCard({ run }: { readonly run: AuditRunOverview }) {
  const presentation = summarizeRunPresentation(run);
  const previewCount = presentation.trailingCount ?? 0;

  return (
    <CardSurface>
      <Stack spacing={1.5}>
        <RunCardHeader presentation={presentation} run={run} />
        <RunPreviewRow previewCount={previewCount} previewItems={presentation.previewItems} />
        <RunMetadataRow run={run} />
        <RunPlanningRow run={run} />
        <RunMetricsRow run={run} />
      </Stack>
    </CardSurface>
  );
}

function RunCardHeader({
  presentation,
  run
}: {
  readonly presentation: ReturnType<typeof summarizeRunPresentation>;
  readonly run: AuditRunOverview;
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
        {presentation.secondaryText === undefined ? null : (
          <Typography color="text.secondary" sx={{ mt: 0.4 }} variant="body2">
            {presentation.secondaryText}
          </Typography>
        )}
      </div>
      <Stack direction="row" spacing={0.75} useFlexGap>
        <Chip label={run.workflow} size="small" variant="outlined" />
        <Chip color={toChipColor(run.status)} label={run.status} size="small" />
      </Stack>
    </Stack>
  );
}

function RunPreviewRow({ previewCount, previewItems }: { readonly previewCount: number; readonly previewItems: string[] }) {
  if (previewItems.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
      {previewItems.map((item) => (
        <PreviewChip icon={<FolderOutlinedIcon fontSize="small" />} key={item} label={formatRelativePath(item)} size="small" variant="filled" />
      ))}
      {previewCount === 0 ? null : <Chip label={`+${previewCount.toString()} more`} size="small" variant="outlined" />}
    </Stack>
  );
}

function RunMetadataRow({ run }: { readonly run: AuditRunOverview }) {
  const metadataLabels = [
    { icon: <RuleFolderOutlinedIcon fontSize="small" />, label: formatRelativePath(run.worktreePath) },
    { icon: <CircleOutlinedIcon fontSize="small" />, label: formatDateTime(run.startedAt) },
    { label: formatDuration(run.durationMs) },
    { label: run.project === undefined ? "No project" : `Project ${run.project}` },
    { label: run.agentName === undefined ? "No agent" : `Agent ${run.agentName}` }
  ];

  return (
    <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
      {metadataLabels.map((item) => (
        <Chip icon={item.icon} key={item.label} label={item.label} size="small" variant="outlined" />
      ))}
    </Stack>
  );
}

function RunPlanningRow({ run }: { readonly run: AuditRunOverview }) {
  const planningLabels = [
    ...(run.workItemId === undefined ? [] : [`Work item ${run.workItemId}`]),
    ...(run.planRunId === undefined ? [] : [`Plan run ${run.planRunId}`]),
    ...(run.planStepId === undefined ? [] : [`Plan step ${run.planStepId}`])
  ];

  if (planningLabels.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        No planning linkage recorded for this run.
      </Typography>
    );
  }

  return (
    <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
      {planningLabels.map((label) => (
        <Chip key={`${run.runId}-${label}`} label={label} size="small" variant="outlined" />
      ))}
    </Stack>
  );
}

function RunMetricsRow({ run }: { readonly run: AuditRunOverview }) {
  const failureVariant = run.failureCount > 0 ? "filled" : "outlined";
  const failureColor = run.failureCount > 0 ? "error" : "default";

  return (
    <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
      <Chip label={`${run.executionCount.toString()} executions`} size="small" variant="outlined" />
      <Chip label={`${run.decisionCount.toString()} decisions`} size="small" variant="outlined" />
      <Chip
        color={failureColor}
        icon={run.failureCount > 0 ? <ErrorOutlineOutlinedIcon fontSize="small" /> : undefined}
        label={`${run.failureCount.toString()} failures`}
        size="small"
        variant={failureVariant}
      />
    </Stack>
  );
}

function toChipColor(status: AuditRunOverview["status"]): "default" | "error" | "success" | "warning" {
  switch (status) {
    case "failed":
      return "error";
    case "running":
      return "warning";
    case "skipped":
      return "default";
    case "success":
      return "success";
  }
}
