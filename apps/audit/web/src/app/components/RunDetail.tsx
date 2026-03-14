import {
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";

import type { AuditRunDetail, AuditWorkItemTimeline } from "@taxes/shared";

import { formatDateTime, formatDuration } from "../time.js";
import { AuditPanel, CodeBlock } from "./AuditPanel.js";
import { FailureInvestigationPanel } from "./FailureInvestigationPanel.js";
import { RunOverviewPanel } from "./RunOverviewPanel.js";

interface RunDetailProps {
  readonly detail: AuditRunDetail | null;
  readonly isLoading: boolean;
  readonly timeline: AuditWorkItemTimeline | null;
}

export function RunDetail({ detail, isLoading, timeline }: RunDetailProps) {
  if (detail === null) {
    return (
      <AuditPanel elevation={0}>
        <Typography variant="h3">Run detail</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
          {isLoading ? "Loading run detail..." : "Select a run to inspect its live audit trail."}
        </Typography>
      </AuditPanel>
    );
  }

  return (
    <Stack spacing={2}>
      <RunOverviewPanel detail={detail} timeline={timeline} />
      <FailureInvestigationPanel detail={detail} />
      <EventTimelinePanel detail={detail} />
      <ExecutionsPanel detail={detail} />
      <DecisionsPanel detail={detail} />
      <ArtifactsPanel detail={detail} />
      <FailuresPanel detail={detail} />
      <HandoffsPanel detail={detail} />
    </Stack>
  );
}

function ExecutionsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <AuditPanel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Executions</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Error</TableCell>
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
                  <TableCell>
                    <Typography color="text.secondary" sx={{ maxWidth: 320, whiteSpace: "normal" }} variant="body2">
                      {execution.errorMessage ?? "No error"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Stack>
    </AuditPanel>
  );
}

function DecisionsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <AuditPanel elevation={0}>
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
    </AuditPanel>
  );
}

function ArtifactsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <AuditPanel elevation={0}>
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
    </AuditPanel>
  );
}

function FailuresPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <AuditPanel elevation={0}>
      <Stack spacing={1.5}>
        <Typography variant="h3">Typed failures</Typography>
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
    </AuditPanel>
  );
}

function HandoffsPanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <AuditPanel elevation={0}>
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
    </AuditPanel>
  );
}

function EventTimelinePanel({ detail }: { readonly detail: AuditRunDetail }) {
  return (
    <AuditPanel elevation={0}>
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
                {event.errorMessage === undefined ? null : <CodeBlock>{event.errorMessage}</CodeBlock>}
                {event.metadata === undefined ? null : <CodeBlock>{JSON.stringify(event.metadata, null, 2)}</CodeBlock>}
              </Stack>
            ))
          )}
        </Stack>
      </Stack>
    </AuditPanel>
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
