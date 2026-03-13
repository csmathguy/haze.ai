import { Chip, Divider, List, ListItemButton, Paper, Stack, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

import type { AuditRunOverview } from "@taxes/shared";

import { formatDateTime, formatDuration, formatRelativePath } from "../time.js";

interface RunListProps {
  readonly onSelect: (runId: string) => void;
  readonly runs: AuditRunOverview[];
  readonly selectedRunId: string | null;
}

const ListShell = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden"
}));

export function RunList({ onSelect, runs, selectedRunId }: RunListProps) {
  return (
    <ListShell elevation={0}>
      <Stack spacing={0}>
        <Stack direction="row" justifyContent="space-between" px={2.5} py={2}>
          <div>
            <Typography variant="h3">Recent runs</Typography>
            <Typography color="text.secondary" variant="body2">
              Click a run to inspect executions, decisions, artifacts, and failures.
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
            runs.map((run) => (
              <ListItemButton
                key={run.runId}
                onClick={() => {
                  onSelect(run.runId);
                }}
                selected={run.runId === selectedRunId}
                sx={(theme) => ({
                  "&.Mui-selected": {
                    backgroundColor: alpha(theme.palette.secondary.main, 0.1)
                  },
                  alignItems: "flex-start",
                  py: 2
                })}
              >
                <Stack spacing={0.75} width="100%">
                  <Stack
                    alignItems={{ sm: "center", xs: "flex-start" }}
                    direction={{ sm: "row", xs: "column" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography fontWeight={700} variant="body1">
                      {run.task ?? run.workflow}
                    </Typography>
                    <Chip color={toChipColor(run.status)} label={run.status} size="small" />
                  </Stack>
                  <Typography color="text.secondary" variant="body2">
                    {run.workflow} | {formatRelativePath(run.worktreePath)}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {formatDateTime(run.startedAt)} | {formatDuration(run.durationMs)}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {(run.project ?? "no project")} | {(run.agentName ?? "no agent")} | decisions {run.decisionCount} | failures {run.failureCount}
                  </Typography>
                </Stack>
              </ListItemButton>
            ))
          )}
        </List>
      </Stack>
    </ListShell>
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
