import { Chip, Paper, Stack, Typography } from "@mui/material";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { alpha, styled } from "@mui/material/styles";

import type { AuditFailureInsight, AuditRunDetail } from "@taxes/shared";

import { formatDateTime } from "../time.js";
import { AuditPanel, CodeBlock } from "./AuditPanel.js";

const InsightSurface = styled(Paper)(({ theme }) => ({
  background: `
    linear-gradient(180deg, ${alpha(theme.palette.error.main, 0.08)} 0%, transparent 100%),
    var(--mui-palette-background-paper)
  `,
  border: `1px solid ${alpha(theme.palette.error.main, 0.22)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.05,
  padding: theme.spacing(2)
}));

interface FailureInvestigationPanelProps {
  readonly detail: AuditRunDetail;
}

export function FailureInvestigationPanel({ detail }: FailureInvestigationPanelProps) {
  if (detail.failureInsights.length === 0) {
    return detail.run.status === "failed" ? <MissingFailureInsightsPanel /> : null;
  }

  return (
    <AuditPanel elevation={0}>
      <Stack spacing={1.5}>
        <Stack
          alignItems={{ sm: "center", xs: "flex-start" }}
          direction={{ sm: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1}
        >
          <div>
            <Typography variant="h3">Failure investigation</Typography>
            <Typography color="text.secondary" variant="body2">
              Why this run failed, when it failed, and the closest available log evidence.
            </Typography>
          </div>
          <Chip color="error" icon={<ErrorOutlineOutlinedIcon />} label={`${detail.failureInsights.length.toString()} insights`} size="small" />
        </Stack>
        <Stack spacing={1.25}>
          {detail.failureInsights.map((insight) => (
            <FailureInsightCard insight={insight} key={insight.insightId} />
          ))}
        </Stack>
      </Stack>
    </AuditPanel>
  );
}

function MissingFailureInsightsPanel() {
  return (
    <AuditPanel elevation={0}>
      <Typography variant="h3">Failure investigation</Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
        This run failed, but no structured failure insight was recorded. Check the event timeline and execution list for raw status changes.
      </Typography>
    </AuditPanel>
  );
}

function FailureInsightCard({ insight }: { readonly insight: AuditFailureInsight }) {
  const metadataChips = buildMetadataChips(insight);
  const contextChips = buildContextChips(insight);

  return (
    <InsightSurface elevation={0}>
      <Stack spacing={1.1}>
        <Stack
          alignItems={{ sm: "center", xs: "flex-start" }}
          direction={{ sm: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1}
        >
          <div>
            <Typography variant="body1">{insight.summary}</Typography>
            <Typography color="text.secondary" variant="body2">
              {formatDateTime(insight.timestamp)}
            </Typography>
          </div>
          <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
            {metadataChips.map((chip) => (
              <Chip color={chip.color} key={chip.label} label={chip.label} size="small" variant={chip.variant} />
            ))}
          </Stack>
        </Stack>
        {contextChips.length === 0 ? null : (
          <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
            {contextChips.map((label) => (
              <Chip key={label} label={label} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
        {insight.errorMessage === undefined ? null : <LabeledCodeBlock label="Error message" value={insight.errorMessage} />}
        {insight.detail === undefined ? null : (
          <Stack spacing={0.4}>
            <Typography color="text.secondary" variant="subtitle2">
              Recorded detail
            </Typography>
            <Typography variant="body2">{insight.detail}</Typography>
          </Stack>
        )}
        {insight.logExcerpt === undefined ? null : <LabeledCodeBlock label="Log excerpt" value={insight.logExcerpt} />}
        {insight.logFile === undefined ? null : (
          <Typography color="text.secondary" sx={{ wordBreak: "break-word" }} variant="caption">
            {insight.logFile}
          </Typography>
        )}
      </Stack>
    </InsightSurface>
  );
}

function LabeledCodeBlock({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack spacing={0.4}>
      <Typography color="text.secondary" variant="subtitle2">
        {label}
      </Typography>
      <CodeBlock>{value}</CodeBlock>
    </Stack>
  );
}

function buildMetadataChips(insight: AuditFailureInsight) {
  return [
    { color: "error" as const, label: insight.sourceType, variant: "filled" as const },
    ...(insight.severity === undefined ? [] : [{ color: "error" as const, label: insight.severity, variant: "outlined" as const }]),
    ...(insight.category === undefined ? [] : [{ color: "default" as const, label: insight.category, variant: "outlined" as const }]),
    { color: "default" as const, label: insight.status, variant: "outlined" as const }
  ];
}

function buildContextChips(insight: AuditFailureInsight): string[] {
  return [
    ...(insight.executionName === undefined ? [] : [insight.executionName]),
    ...(insight.step === undefined ? [] : [insight.step]),
    ...(insight.retryable === undefined ? [] : [`retryable ${insight.retryable ? "yes" : "no"}`])
  ];
}
