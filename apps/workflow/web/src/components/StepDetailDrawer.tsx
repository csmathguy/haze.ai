import React from "react";
import {
  Box,
  Drawer as MuiDrawer,
  Typography,
  Divider,
  Stack,
  Chip,
  Button
} from "@mui/material";

import type { WorkflowStepRun } from "../app/api.js";
import type { WorkflowStep } from "./workflow-types.js";

interface StepDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedStep: WorkflowStep | null;
  selectedStepRun: WorkflowStepRun | null;
}

function getRunStatusInfo(stepRun: WorkflowStepRun): { label: string; color: "error" | "success" | "info" } {
  if (stepRun.errorJson) return { label: "Failed", color: "error" };
  if (stepRun.completedAt) return { label: "Completed", color: "success" };
  return { label: "In Progress", color: "info" };
}

const jsonBoxSx = {
  bgcolor: "background.paper",
  p: 1,
  borderRadius: 1,
  border: "1px solid",
  borderColor: "divider",
  overflow: "auto",
  maxHeight: 150
};

const errorBoxSx = {
  bgcolor: "error.lighter",
  p: 1,
  borderRadius: 1,
  border: "1px solid",
  borderColor: "error.light",
  overflow: "auto",
  maxHeight: 150
};

const monoTypeSx = {
  fontFamily: "monospace",
  fontSize: "0.75rem",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word"
};

interface StepRunSectionProps {
  stepRun: WorkflowStepRun;
}

const StepRunSection: React.FC<StepRunSectionProps> = ({ stepRun }) => {
  const { label, color } = getRunStatusInfo(stepRun);
  const durationMs = stepRun.completedAt
    ? new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()
    : null;

  return (
    <>
      <Box sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
        <Typography variant="overline" color="textSecondary">Status</Typography>
        <Chip label={label} size="small" color={color} variant="filled" sx={{ mr: 1 }} />
        {stepRun.retryCount > 0 && (
          <Chip label={`Retries: ${String(stepRun.retryCount)}`} size="small" variant="outlined" />
        )}
      </Box>

      {durationMs !== null && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="textSecondary">Duration</Typography>
          <Typography variant="body2">{String(durationMs)}ms</Typography>
        </Box>
      )}

      {stepRun.model && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="textSecondary">Agent Model</Typography>
          <Typography variant="body2">{stepRun.model}</Typography>
        </Box>
      )}

      {stepRun.inputJson && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="textSecondary">Input</Typography>
          <Box sx={jsonBoxSx}>
            <Typography variant="caption" sx={monoTypeSx}>{stepRun.inputJson}</Typography>
          </Box>
        </Box>
      )}

      {stepRun.outputJson && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="textSecondary">Output</Typography>
          <Box sx={jsonBoxSx}>
            <Typography variant="caption" sx={monoTypeSx}>{stepRun.outputJson}</Typography>
          </Box>
        </Box>
      )}

      {stepRun.errorJson && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="error">Error</Typography>
          <Box sx={errorBoxSx}>
            <Typography variant="caption" sx={{ ...monoTypeSx, color: "error.dark" }}>
              {stepRun.errorJson}
            </Typography>
          </Box>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />
    </>
  );
};

interface StepDefinitionSectionProps {
  step: WorkflowStep;
}

const StepDefinitionSection: React.FC<StepDefinitionSectionProps> = ({ step }) => (
  <Stack spacing={2}>
    <Box>
      <Typography variant="overline" color="textSecondary">Label</Typography>
      <Typography variant="body2">{step.label}</Typography>
    </Box>

    <Box>
      <Typography variant="overline" color="textSecondary">Type</Typography>
      <Chip label={step.type} size="small" />
    </Box>

    {step.scriptPath && (
      <Box>
        <Typography variant="overline" color="textSecondary">Script Path</Typography>
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
          {step.scriptPath}
        </Typography>
      </Box>
    )}

    {step.agentName && (
      <>
        <Box>
          <Typography variant="overline" color="textSecondary">Agent Name</Typography>
          <Typography variant="body2">{step.agentName}</Typography>
        </Box>
        {step.model && (
          <Box>
            <Typography variant="overline" color="textSecondary">Model</Typography>
            <Typography variant="body2">{step.model}</Typography>
          </Box>
        )}
        {step.skills && step.skills.length > 0 && (
          <Box>
            <Typography variant="overline" color="textSecondary">Skills</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {step.skills.map((skill) => (
                <Chip key={skill} label={skill} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
      </>
    )}

    {step.timeout && (
      <Box>
        <Typography variant="overline" color="textSecondary">Timeout (ms)</Typography>
        <Typography variant="body2">{step.timeout}</Typography>
      </Box>
    )}

    {step.retryPolicy && (
      <Box>
        <Typography variant="overline" color="textSecondary">Retry Policy</Typography>
        <Typography variant="body2" sx={monoTypeSx}>
          {JSON.stringify(step.retryPolicy, null, 2)}
        </Typography>
      </Box>
    )}

    {step.branches && Object.keys(step.branches).length > 0 && (
      <Box>
        <Typography variant="overline" color="textSecondary">Condition Branches</Typography>
        <Stack spacing={1}>
          {Object.entries(step.branches).map(([condition, targetId]) => (
            <Box key={condition} sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="caption" color="textSecondary">{condition} →</Typography>
              <Typography variant="body2">{targetId}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    )}
  </Stack>
);

export const StepDetailDrawer: React.FC<StepDetailDrawerProps> = ({
  open,
  onClose,
  selectedStep,
  selectedStepRun
}) => {
  if (!selectedStep) return null;

  return (
    <MuiDrawer anchor="right" open={open} onClose={onClose} sx={{ minWidth: 350 }}>
      <Box sx={{ width: 350, p: 3, overflow: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Typography variant="h6">{selectedStepRun ? "Run Details" : "Step Details"}</Typography>
          <Button size="small" onClick={onClose}>Close</Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {selectedStepRun && <StepRunSection stepRun={selectedStepRun} />}
        <StepDefinitionSection step={selectedStep} />
      </Box>
    </MuiDrawer>
  );
};
