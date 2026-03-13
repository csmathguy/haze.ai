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
      <DecisionsPanel detail={detail} />
      <ArtifactsPanel detail={detail} />
      <FailuresPanel detail={detail} />
      <HandoffsPanel detail={detail} />
      <EventTimelinePanel detail={detail} />
    </Stack>
  );
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

function DecisionsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <Panel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Decisions</Typography>
        {detail.decisions.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No explicit decisions were recorded for this run.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {detail.decisions.map((decision) => (
              <Stack key={decision.decisionId} spacing={0.5}>
                <Typography fontWeight={700} variant="body2">
                  {decision.summary}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {decision.category} | {decision.selectedOption ?? "No selected option"} | {formatDateTime(decision.timestamp)}
                </Typography>
                {decision.rationale === undefined ? null : (
                  <Typography color="text.secondary" variant="body2">
                    {decision.rationale}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}

function ArtifactsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <Panel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Artifacts</Typography>
        {detail.artifacts.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No artifacts were recorded for this run.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {detail.artifacts.map((artifact) => (
              <Stack key={artifact.artifactId} spacing={0.5}>
                <Typography fontWeight={700} variant="body2">
                  {artifact.label}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {artifact.artifactType} | {artifact.status} | {formatDateTime(artifact.timestamp)}
                </Typography>
                {artifact.path === undefined ? null : (
                  <Typography color="text.secondary" sx={{ wordBreak: "break-word" }} variant="caption">
                    {artifact.path}
                  </Typography>
                )}
                {artifact.uri === undefined ? null : (
                  <Typography color="text.secondary" sx={{ wordBreak: "break-word" }} variant="caption">
                    {artifact.uri}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}

function FailuresPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <Panel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Failures</Typography>
        {detail.failures.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No classified failures were recorded for this run.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {detail.failures.map((failure) => (
              <Stack key={failure.failureId} spacing={0.5}>
                <Stack
                  alignItems={{ sm: "center", xs: "flex-start" }}
                  direction={{ sm: "row", xs: "column" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography fontWeight={700} variant="body2">
                    {failure.summary}
                  </Typography>
                  <Chip color="error" label={`${failure.severity} ${failure.status}`} size="small" />
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  {failure.category} | retryable {failure.retryable ? "yes" : "no"} | {formatDateTime(failure.timestamp)}
                </Typography>
                {failure.detail === undefined ? null : (
                  <Typography color="text.secondary" variant="body2">
                    {failure.detail}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}

function HandoffsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <Panel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Handoffs</Typography>
        {detail.handoffs.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No explicit handoffs were recorded for this run.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {detail.handoffs.map((handoff) => (
              <Stack key={handoff.handoffId} spacing={0.5}>
                <Stack
                  alignItems={{ sm: "center", xs: "flex-start" }}
                  direction={{ sm: "row", xs: "column" }}
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography fontWeight={700} variant="body2">
                    {handoff.sourceAgent} {"->"} {handoff.targetAgent}
                  </Typography>
                  <Chip color={toHandoffChipColor(handoff.status)} label={handoff.status} size="small" />
                </Stack>
                <Typography variant="body2">{handoff.summary}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {formatDateTime(handoff.timestamp)}
                </Typography>
                {handoff.detail === undefined ? null : (
                  <Typography color="text.secondary" variant="body2">
                    {handoff.detail}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
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

function DetailGrid({ items }: { readonly items: { label: string; value: string }[] }) {
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

function toHandoffChipColor(status: string): "default" | "error" | "info" | "success" | "warning" {
  switch (status) {
    case "accepted":
      return "info";
    case "blocked":
      return "error";
    case "completed":
      return "success";
    case "pending":
      return "warning";
    default:
      return "default";
  }
}
