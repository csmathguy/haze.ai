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

// ---------------------------------------------------------------------------
// StdoutBlock
// ---------------------------------------------------------------------------

interface StdoutBlockProps {
  label: string;
  content: string;
  maxHeight?: number;
  color?: string;
  bg?: string;
}

export const StdoutBlock: React.FC<StdoutBlockProps> = ({ label, content, maxHeight = 200, color = "grey.100", bg = "grey.900" }) => (
  <Box sx={{ mt: 1 }}>
    <Typography variant="overline" color="textSecondary" sx={{ display: "block", mb: 0.5 }}>
      {label}
    </Typography>
    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: bg, color, maxHeight, overflow: "auto" }}>
      <Typography component="pre" sx={{ fontFamily: "monospace", fontSize: "0.75rem", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {content}
      </Typography>
    </Box>
  </Box>
);

// ---------------------------------------------------------------------------
// StepDetailDrawer
// ---------------------------------------------------------------------------

interface TokenUsage { inputTokens: number; outputTokens: number; totalTokens: number }

function parseTokenUsage(json: string | null | undefined): TokenUsage | null {
  if (!json) return null;
  try { return JSON.parse(json) as TokenUsage; } catch { return null; }
}

const getStepRunStatus = (stepRun: WorkflowStepRun): { label: string; color: "error" | "success" | "info" } => {
  if (stepRun.errorJson) return { label: "Failed", color: "error" };
  if (stepRun.completedAt) return { label: "Completed", color: "success" };
  return { label: "Running", color: "info" };
};

const formatDate = (date: string): string => new Date(date).toLocaleString();

const formatElapsed = (ms: number): string => {
  if (ms < 60_000) return `${String(Math.floor(ms / 1000))}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${String(mins)}m ${String(secs)}s`;
};

interface StepDetailContentProps {
  stepRun: WorkflowStepRun;
  onClose: () => void;
}

const StepDetailContent: React.FC<StepDetailContentProps> = ({ stepRun, onClose }) => {
  const chip = getStepRunStatus(stepRun);
  const tokenUsage = parseTokenUsage(stepRun.tokenUsageJson);
  const durationMs = stepRun.completedAt
    ? new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()
    : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6" sx={{ flex: 1, fontFamily: "monospace", fontSize: "0.9rem" }}>{stepRun.stepId}</Typography>
        <Chip label={chip.label} size="small" color={chip.color} />
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ p: 2, overflowY: "auto", flex: 1 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Box><Typography variant="overline" color="textSecondary">Type</Typography><Typography variant="body2">{stepRun.stepType}</Typography></Box>
            {durationMs !== null && <Box><Typography variant="overline" color="textSecondary">Duration</Typography><Typography variant="body2">{formatElapsed(durationMs)}</Typography></Box>}
            <Box><Typography variant="overline" color="textSecondary">Started</Typography><Typography variant="body2">{formatDate(stepRun.startedAt)}</Typography></Box>
          </Stack>

          {tokenUsage && (
            <>
              <Divider />
              <Box>
                <Typography variant="overline" color="textSecondary" sx={{ display: "block", mb: 1 }}>Token Usage</Typography>
                <Stack direction="row" spacing={2}>
                  <Chip label={`In: ${String(tokenUsage.inputTokens)}`} size="small" variant="outlined" />
                  <Chip label={`Out: ${String(tokenUsage.outputTokens)}`} size="small" variant="outlined" />
                  <Chip label={`Total: ${String(tokenUsage.totalTokens)}`} size="small" color="primary" variant="outlined" />
                </Stack>
              </Box>
            </>
          )}

          {stepRun.errorJson && (
            <>
              <Divider />
              <StdoutBlock label="error" content={stepRun.errorJson} bg="error.light" color="error.contrastText" maxHeight={300} />
            </>
          )}

          {stepRun.stdout && (
            <>
              <Divider />
              <StdoutBlock label="stdout" content={stepRun.stdout} maxHeight={400} />
            </>
          )}

          {stepRun.stderr && (
            <>
              <Divider />
              <StdoutBlock label="stderr" content={stepRun.stderr} maxHeight={200} bg="grey.800" color="warning.light" />
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
};

interface StepDetailDrawerProps {
  stepRun: WorkflowStepRun | null;
  onClose: () => void;
}

const StepDetailDrawer: React.FC<StepDetailDrawerProps> = ({ stepRun, onClose }) => {
  const open = stepRun !== null;
  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 560 }, p: 0 } } }}>
      {stepRun && <StepDetailContent stepRun={stepRun} onClose={onClose} />}
    </Drawer>
  );
};

// ---------------------------------------------------------------------------
// StepTimelineRow
// ---------------------------------------------------------------------------

const getOutputPreview = (stepRun: WorkflowStepRun): string => {
  if (stepRun.stdout) {
    return stepRun.stdout.trim().split("\n").at(-1)?.slice(0, 80) ?? "";
  }
  if (stepRun.errorJson) {
    try {
      const parsed = JSON.parse(stepRun.errorJson) as { message?: string };
      return parsed.message?.slice(0, 80) ?? "error";
    } catch {
      return stepRun.errorJson.slice(0, 80);
    }
  }
  return "-";
};

interface StepTimelineRowProps {
  stepRun: WorkflowStepRun;
  onSelect: (stepRun: WorkflowStepRun) => void;
}

const StepTimelineRow: React.FC<StepTimelineRowProps> = ({ stepRun, onSelect }) => {
  const chip = getStepRunStatus(stepRun);
  const durationMs = stepRun.completedAt
    ? new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()
    : null;
  const durationLabel = durationMs !== null ? formatElapsed(durationMs) : "running…";
  const preview = getOutputPreview(stepRun);
  const tokenUsage = parseTokenUsage(stepRun.tokenUsageJson);

  return (
    <TableRow
      hover
      sx={{ cursor: "pointer" }}
      onClick={() => { onSelect(stepRun); }}
    >
      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{stepRun.stepId}</TableCell>
      <TableCell sx={{ fontSize: "0.8rem" }}>{stepRun.stepType}</TableCell>
      <TableCell><Chip label={chip.label} size="small" color={chip.color} variant="filled" /></TableCell>
      <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{durationLabel}</TableCell>
      {tokenUsage !== null
        ? <TableCell sx={{ fontSize: "0.75rem" }}>{String(tokenUsage.totalTokens)} tok</TableCell>
        : <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary", maxWidth: 300 }}>{preview}</TableCell>
      }
    </TableRow>
  );
};

// ---------------------------------------------------------------------------
// StepTimeline
// ---------------------------------------------------------------------------

interface StepTimelineProps {
  stepRuns: WorkflowRun["stepRuns"];
}

export const StepTimeline: React.FC<StepTimelineProps> = ({ stepRuns }) => {
  const [selectedStep, setSelectedStep] = useState<WorkflowStepRun | null>(null);
  if (!stepRuns || stepRuns.length === 0) return null;
  const sortedRuns = [...stepRuns].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  return (
    <>
      <Typography variant="h6" sx={{ mb: 2 }}>Step Timeline <Typography component="span" variant="caption" color="textSecondary">(click row for details)</Typography></Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "action.hover" }}>
              <TableCell>Step ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Output / Tokens</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRuns.map((stepRun) => (
              <StepTimelineRow key={stepRun.id} stepRun={stepRun} onSelect={setSelectedStep} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <StepDetailDrawer stepRun={selectedStep} onClose={() => { setSelectedStep(null); }} />
    </>
  );
};
