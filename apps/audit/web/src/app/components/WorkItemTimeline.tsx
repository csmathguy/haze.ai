import { Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

import type { AuditWorkItemTimeline } from "@taxes/shared";

import { formatDateTime } from "../time.js";

interface WorkItemTimelineProps {
  readonly isLoading: boolean;
  readonly timeline: AuditWorkItemTimeline | null;
}

const Panel = styled(Paper)(({ theme }) => ({
  border: "1px solid var(--mui-palette-divider)",
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2.5)
}));

export function WorkItemTimeline({ isLoading, timeline }: WorkItemTimelineProps) {
  if (timeline === null) {
    return (
      <Panel elevation={0}>
        <Typography variant="h3">Work item timeline</Typography>
        <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
          {isLoading ? "Loading work item timeline..." : "Select a run linked to a work item to inspect the cross-run lineage."}
        </Typography>
      </Panel>
    );
  }

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
            <Typography variant="h3">Work item timeline</Typography>
            <Typography color="text.secondary" variant="body2">
              {timeline.workItemId}
            </Typography>
          </div>
          <Chip color="primary" label={`${String(timeline.summary.runCount)} runs`} size="small" />
        </Stack>
        <TimelineSummary timeline={timeline} />
        <RecentHandoffs timeline={timeline} />
      </Stack>
    </Panel>
  );
}

function TimelineSummary({ timeline }: { readonly timeline: AuditWorkItemTimeline }) {
  return (
    <Stack direction={{ md: "row", xs: "column" }} flexWrap="wrap" spacing={1.5} useFlexGap>
      <SummaryCard label="Agents" value={timeline.summary.activeAgents.join(", ") || "Unassigned"} />
      <SummaryCard label="Workflows" value={timeline.summary.workflows.join(", ") || "None"} />
      <SummaryCard label="Events" value={timeline.events.length.toString()} />
      <SummaryCard label="Handoffs" value={timeline.summary.handoffCount.toString()} />
      <SummaryCard label="Failures" value={timeline.summary.failureCount.toString()} />
      <SummaryCard label="Latest event" value={formatDateTime(timeline.summary.latestEventAt)} />
    </Stack>
  );
}

function RecentHandoffs({ timeline }: { readonly timeline: AuditWorkItemTimeline }) {
  return (
    <Stack spacing={1}>
      <Typography variant="h3">Recent handoffs</Typography>
      {timeline.handoffs.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          No explicit handoffs recorded for this work item yet.
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={1}>
          {timeline.handoffs.slice(-5).reverse().map((handoff) => (
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
                <Chip color={toHandoffColor(handoff.status)} label={handoff.status} size="small" />
              </Stack>
              <Typography variant="body2">{handoff.summary}</Typography>
              <Typography color="text.secondary" variant="caption">
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
  );
}

function SummaryCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid var(--mui-palette-divider)",
        flex: "1 1 200px",
        p: 1.5
      }}
    >
      <Typography color="text.secondary" variant="subtitle2">
        {label}
      </Typography>
      <Typography sx={{ mt: 0.75, wordBreak: "break-word" }} variant="body2">
        {value}
      </Typography>
    </Paper>
  );
}

function toHandoffColor(status: string): "default" | "error" | "info" | "success" | "warning" {
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
