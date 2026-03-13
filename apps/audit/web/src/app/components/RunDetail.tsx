import {
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { styled } from "@mui/material/styles";

import type { AuditRunDetail } from "@taxes/shared";

import { formatDateTime, formatDuration } from "../time.js";

interface RunDetailProps {
  readonly detail: AuditRunDetail | null;
  readonly isLoading: boolean;
}

const Panel = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2.5)
}));

export function RunDetail({ detail, isLoading }: RunDetailProps) {
  if (detail === null) {
    return (
      <Panel elevation={0}>
        <Typography variant="h3">Run detail</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
          {isLoading ? "Loading run detail..." : "Select a run to inspect its live audit trail."}
        </Typography>
      </Panel>
    );
  }

  return (
    <Stack spacing={2}>
      <RunOverviewPanel detail={detail} />
      <ExecutionsPanel detail={detail} />
      <EventTimelinePanel detail={detail} />
    </Stack>
  );
}

interface DetailGridProps {
  readonly items: { label: string; value: string }[];
}

function RunOverviewPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <Panel elevation={0}>
      <Stack spacing={1.5}>
        <Stack
          alignItems={{ sm: "center", xs: "flex-start" }}
          direction={{ sm: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1}
        >
          <div>
            <Typography variant="h3">{detail.run.task ?? detail.run.workflow}</Typography>
            <Typography color="text.secondary" variant="body2">
              {detail.run.runId}
            </Typography>
          </div>
          <Chip color={toChipColor(detail.run.status)} label={detail.run.status} />
        </Stack>
        <DetailGrid
          items={[
            { label: "Workflow", value: detail.run.workflow },
            { label: "Actor", value: detail.run.actor },
            { label: "Worktree", value: detail.run.worktreePath },
            { label: "Started", value: formatDateTime(detail.run.startedAt) },
            { label: "Completed", value: formatDateTime(detail.run.completedAt) },
            { label: "Duration", value: formatDuration(detail.run.durationMs) }
          ]}
        />
      </Stack>
    </Panel>
  );
}

function ExecutionsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <Panel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Executions</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Started</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.executions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>No executions recorded yet.</TableCell>
              </TableRow>
            ) : (
              detail.executions.map((execution) => (
                <TableRow key={execution.executionId}>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">{execution.name}</Typography>
                      {execution.step === undefined ? null : (
                        <Typography color="text.secondary" variant="caption">
                          {execution.step}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{execution.kind}</TableCell>
                  <TableCell>
                    <Chip color={toChipColor(execution.status)} label={execution.status} size="small" />
                  </TableCell>
                  <TableCell>{formatDuration(execution.durationMs)}</TableCell>
                  <TableCell>{formatDateTime(execution.startedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Stack>
    </Panel>
  );
}

function EventTimelinePanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <Panel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Event timeline</Typography>
        <Stack divider={<Divider flexItem />} spacing={1}>
          {detail.events.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              No events recorded yet.
            </Typography>
          ) : (
            detail.events.map((event) => (
              <Stack key={event.eventId} spacing={0.5}>
                <Stack
                  alignItems={{ sm: "center", xs: "flex-start" }}
                  direction={{ sm: "row", xs: "column" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography fontWeight={700} variant="body2">
                    {event.eventType}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {formatDateTime(event.timestamp)}
                  </Typography>
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  {event.executionName ?? event.task ?? event.workflow}
                </Typography>
                {event.metadata === undefined ? null : (
                  <Typography color="text.secondary" sx={{ wordBreak: "break-word" }} variant="caption">
                    {JSON.stringify(event.metadata)}
                  </Typography>
                )}
              </Stack>
            ))
          )}
        </Stack>
      </Stack>
    </Panel>
  );
}

function DetailGrid({ items }: DetailGridProps) {
  return (
    <Stack direction={{ md: "row", xs: "column" }} flexWrap="wrap" spacing={1.5} useFlexGap>
      {items.map((item) => (
        <Paper
          elevation={0}
          key={item.label}
          sx={{
            border: "1px solid var(--mui-palette-divider)",
            flex: "1 1 220px",
            p: 1.5
          }}
        >
          <Typography color="text.secondary" variant="subtitle2">
            {item.label}
          </Typography>
          <Typography sx={{ mt: 0.75, wordBreak: "break-word" }} variant="body2">
            {item.value}
          </Typography>
        </Paper>
      ))}
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
