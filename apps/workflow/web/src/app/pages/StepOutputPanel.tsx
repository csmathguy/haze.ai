import React, { useState } from "react";
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import type { WorkflowRun, WorkflowStepRun } from "../api.js";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface JsonSectionProps {
  content: string;
  label: string;
}

interface StdoutBlockProps {
  bg?: string;
  color?: string;
  content: string;
  label: string;
  maxHeight?: number;
}

function parseTokenUsage(json: string | null | undefined): TokenUsage | null {
  if (!json) return null;
  try { return JSON.parse(json) as TokenUsage; } catch { return null; }
}

function parseJsonValue(json: string | null | undefined): string | null {
  if (!json) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(json) as unknown, null, 2);
  } catch {
    return json;
  }
}

function getStepRunStatus(stepRun: WorkflowStepRun): { color: "error" | "success" | "info"; label: string } {
  if (stepRun.errorJson) return { label: "Failed", color: "error" };
  if (stepRun.completedAt) return { label: "Completed", color: "success" };
  return { label: "Running", color: "info" };
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

function formatElapsed(ms: number): string {
  if (ms < 60_000) return `${String(Math.floor(ms / 1000))}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${String(mins)}m ${String(secs)}s`;
}

function getOutputPreview(stepRun: WorkflowStepRun): string {
  const outputPreview = getFirstLinePreview(parseJsonValue(stepRun.outputJson));
  if (outputPreview !== null) return outputPreview;

  const stdoutPreview = getFirstLinePreview(stepRun.stdout?.trim().split("\n").at(-1) ?? null);
  if (stdoutPreview !== null) return stdoutPreview;

  return getErrorPreview(stepRun.errorJson);
}

function getFirstLinePreview(value: string | null): string | null {
  return value?.split("\n")[0]?.slice(0, 80) ?? null;
}

function getErrorPreview(errorJson: string | null): string {
  if (!errorJson) {
    return "-";
  }

  try {
    const parsed = JSON.parse(errorJson) as { message?: string };
    return parsed.message?.slice(0, 80) ?? "error";
  } catch {
    return errorJson.slice(0, 80);
  }
}

export const StdoutBlock: React.FC<StdoutBlockProps> = ({ bg = "grey.900", color = "grey.100", content, label, maxHeight = 220 }) => (
  <Box>
    <Typography color="text.secondary" sx={{ display: "block", mb: 0.5 }} variant="overline">
      {label}
    </Typography>
    <Box sx={{ backgroundColor: bg, borderRadius: 1, color, maxHeight, overflow: "auto", p: 1.5 }}>
      <Typography component="pre" sx={{ fontFamily: "monospace", fontSize: "0.75rem", m: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {content}
      </Typography>
    </Box>
  </Box>
);

const JsonSection: React.FC<JsonSectionProps> = ({ content, label }) => (
  <Box>
    <Typography color="text.secondary" sx={{ display: "block", mb: 0.5 }} variant="overline">
      {label}
    </Typography>
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, maxHeight: 260, overflow: "auto", p: 1.5 }}>
      <Typography component="pre" sx={{ fontFamily: "monospace", fontSize: "0.75rem", m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {content}
      </Typography>
    </Box>
  </Box>
);

const StepSummarySection: React.FC<{ stepRun: WorkflowStepRun }> = ({ stepRun }) => {
  const parsedOutput = parseJsonValue(stepRun.outputJson);
  const parsedInput = parseJsonValue(stepRun.inputJson);
  const parsedError = parseJsonValue(stepRun.errorJson);

  return (
    <Stack spacing={2}>
      {parsedInput ? <JsonSection content={parsedInput} label="Input" /> : null}
      {parsedOutput ? <JsonSection content={parsedOutput} label="Output" /> : null}
      {parsedError ? <JsonSection content={parsedError} label="Result / Error" /> : null}
    </Stack>
  );
};

const StepRuntimeSection: React.FC<{ stepRun: WorkflowStepRun }> = ({ stepRun }) => {
  const tokenUsage = parseTokenUsage(stepRun.tokenUsageJson);
  const durationMs = stepRun.completedAt
    ? new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()
    : null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" flexWrap="wrap" spacing={2} useFlexGap>
        <Box>
          <Typography color="text.secondary" variant="overline">Type</Typography>
          <Typography variant="body2">{stepRun.stepType}</Typography>
        </Box>
        <Box>
          <Typography color="text.secondary" variant="overline">Node</Typography>
          <Typography variant="body2">{stepRun.nodeType}</Typography>
        </Box>
        <Box>
          <Typography color="text.secondary" variant="overline">Started</Typography>
          <Typography variant="body2">{formatDate(stepRun.startedAt)}</Typography>
        </Box>
        {durationMs !== null ? (
          <Box>
            <Typography color="text.secondary" variant="overline">Duration</Typography>
            <Typography variant="body2">{formatElapsed(durationMs)}</Typography>
          </Box>
        ) : null}
      </Stack>

      <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
        {stepRun.agentId ? <Chip label={`Agent: ${stepRun.agentId}`} size="small" variant="outlined" /> : null}
        {stepRun.model ? <Chip label={`Model: ${stepRun.model}`} size="small" variant="outlined" /> : null}
        {stepRun.skillIds ? <Chip label={`Skills: ${stepRun.skillIds}`} size="small" variant="outlined" /> : null}
        {stepRun.retryCount > 0 ? <Chip label={`Retries: ${String(stepRun.retryCount)}`} size="small" variant="outlined" /> : null}
      </Stack>

      {tokenUsage ? (
        <Stack direction="row" spacing={1}>
          <Chip label={`In: ${String(tokenUsage.inputTokens)}`} size="small" variant="outlined" />
          <Chip label={`Out: ${String(tokenUsage.outputTokens)}`} size="small" variant="outlined" />
          <Chip color="primary" label={`Total: ${String(tokenUsage.totalTokens)}`} size="small" variant="outlined" />
        </Stack>
      ) : null}
    </Stack>
  );
};

const StepLogsSection: React.FC<{ stepRun: WorkflowStepRun }> = ({ stepRun }) => (
  <Stack spacing={2}>
    {stepRun.stdout ? <StdoutBlock content={stepRun.stdout} label={stepRun.nodeType === "agent" ? "Agent Transcript / Stdout" : "Script Stdout"} maxHeight={420} /> : null}
    {stepRun.stderr ? <StdoutBlock bg="grey.800" color="warning.light" content={stepRun.stderr} label="Stderr" maxHeight={220} /> : null}
    {stepRun.errorJson ? <StdoutBlock bg="error.light" color="error.contrastText" content={stepRun.errorJson} label="Failure Payload" maxHeight={320} /> : null}
  </Stack>
);

const StepDetailContent: React.FC<{
  onClose: () => void;
  stepRun: WorkflowStepRun;
}> = ({ onClose, stepRun }) => {
  const chip = getStepRunStatus(stepRun);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ alignItems: "center", borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 1, p: 2 }}>
        <Typography sx={{ flex: 1, fontFamily: "monospace", fontSize: "0.9rem" }} variant="h6">{stepRun.stepId}</Typography>
        <Chip color={chip.color} label={chip.label} size="small" />
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        <Stack spacing={2}>
          <StepRuntimeSection stepRun={stepRun} />
          <Divider />
          <StepSummarySection stepRun={stepRun} />
          <Divider />
          <StepLogsSection stepRun={stepRun} />
        </Stack>
      </Box>
    </Box>
  );
};

const StepDetailDrawer: React.FC<{
  onClose: () => void;
  stepRun: WorkflowStepRun | null;
}> = ({ onClose, stepRun }) => (
  <Drawer anchor="right" onClose={onClose} open={stepRun !== null} slotProps={{ paper: { sx: { p: 0, width: { xs: "100%", sm: 640 } } } }}>
    {stepRun ? <StepDetailContent onClose={onClose} stepRun={stepRun} /> : null}
  </Drawer>
);

const StepTimelineRow: React.FC<{
  onSelect: (stepRun: WorkflowStepRun) => void;
  stepRun: WorkflowStepRun;
}> = ({ onSelect, stepRun }) => {
  const chip = getStepRunStatus(stepRun);
  const durationMs = stepRun.completedAt
    ? new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()
    : null;
  const durationLabel = durationMs !== null ? formatElapsed(durationMs) : "running...";
  const preview = getOutputPreview(stepRun);
  const tokenUsage = parseTokenUsage(stepRun.tokenUsageJson);

  return (
    <TableRow hover onClick={() => { onSelect(stepRun); }} sx={{ cursor: "pointer" }}>
      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{stepRun.stepId}</TableCell>
      <TableCell sx={{ fontSize: "0.8rem" }}>{stepRun.stepType}</TableCell>
      <TableCell><Chip color={chip.color} label={chip.label} size="small" variant="filled" /></TableCell>
      <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{durationLabel}</TableCell>
      {tokenUsage
        ? <TableCell sx={{ fontSize: "0.75rem" }}>{String(tokenUsage.totalTokens)} tok</TableCell>
        : <TableCell sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.75rem", maxWidth: 300 }}>{preview}</TableCell>}
    </TableRow>
  );
};

export const StepTimeline: React.FC<{
  stepRuns: WorkflowRun["stepRuns"];
}> = ({ stepRuns }) => {
  const [selectedStep, setSelectedStep] = useState<WorkflowStepRun | null>(null);

  if (!stepRuns || stepRuns.length === 0) return null;

  const sortedRuns = [...stepRuns].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  return (
    <>
      <Typography sx={{ mb: 2 }} variant="h6">
        Step Timeline{" "}
        <Typography color="text.secondary" component="span" variant="caption">
          (click row for audit details)
        </Typography>
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "action.hover" }}>
              <TableCell>Step ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Result Preview</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRuns.map((stepRun) => (
              <StepTimelineRow key={stepRun.id} onSelect={setSelectedStep} stepRun={stepRun} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <StepDetailDrawer onClose={() => { setSelectedStep(null); }} stepRun={selectedStep} />
    </>
  );
};
