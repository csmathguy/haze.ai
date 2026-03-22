import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { PlanningWorkspace } from "@taxes/shared";
import { useState } from "react";

import { startPlanningSession } from "../api.js";

interface PlanningWorkspaceToolbarProps {
  readonly onCreateWorkItem: () => void;
  readonly onPlanningSessionStarted: (runId: string) => void;
  readonly projects: PlanningWorkspace["projects"];
  readonly selectedProjectKey: string;
  readonly setSelectedProjectKey: (projectKey: string) => void;
  readonly totalVisibleItems: number;
}

export function PlanningWorkspaceToolbar({
  onCreateWorkItem,
  onPlanningSessionStarted,
  projects,
  selectedProjectKey,
  setSelectedProjectKey,
  totalVisibleItems
}: PlanningWorkspaceToolbarProps) {
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);

  return (
    <Stack
      direction={{ lg: "row", xs: "column" }}
      justifyContent="space-between"
      spacing={2}
    >
      <Stack spacing={0.5}>
        <Typography color="text.secondary">
          Review the backlog as a board and open focused drawers only when you need to create or inspect work.
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {totalVisibleItems.toString()} item(s) in the current scope.
        </Typography>
      </Stack>
      <Stack direction={{ sm: "row", xs: "column" }} spacing={1.5}>
        <TextField
          label="Project scope"
          onChange={(event) => {
            setSelectedProjectKey(event.target.value);
          }}
          select
          sx={{ minWidth: 220 }}
          value={selectedProjectKey}
        >
          <MenuItem value="all">All projects</MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.key} value={project.key}>
              {project.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          onClick={() => {
            setSessionDialogOpen(true);
          }}
          startIcon={<AutoAwesomeRoundedIcon />}
          variant="outlined"
        >
          New planning session
        </Button>
        <Button
          onClick={onCreateWorkItem}
          startIcon={<AddRoundedIcon />}
          variant="contained"
        >
          New work item
        </Button>
      </Stack>
      <NewPlanningSessionDialog
        onClose={() => {
          setSessionDialogOpen(false);
        }}
        onStarted={(runId) => {
          setSessionDialogOpen(false);
          onPlanningSessionStarted(runId);
        }}
        open={sessionDialogOpen}
        projects={projects}
      />
    </Stack>
  );
}

interface NewPlanningSessionDialogProps {
  readonly onClose: () => void;
  readonly onStarted: (runId: string) => void;
  readonly open: boolean;
  readonly projects: PlanningWorkspace["projects"];
}

function usePlanningSessionDialog(onStarted: (runId: string) => void) {
  const [idea, setIdea] = useState("");
  const [projectKey, setProjectKey] = useState("planning");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setIdea("");
    setError(null);
  }

  async function handleStart() {
    if (idea.trim().length === 0) {
      setError("Please describe your idea or problem before starting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await startPlanningSession(idea.trim(), projectKey || undefined);
      reset();
      onStarted(result.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start planning session.");
    } finally {
      setBusy(false);
    }
  }

  return { idea, setIdea, projectKey, setProjectKey, error, busy, reset, handleStart };
}

function NewPlanningSessionDialog({
  onClose,
  onStarted,
  open,
  projects
}: NewPlanningSessionDialogProps) {
  const { idea, setIdea, projectKey, setProjectKey, error, busy, reset, handleStart } =
    usePlanningSessionDialog(onStarted);

  function handleClose() {
    if (!busy) {
      reset();
      onClose();
    }
  }

  return (
    <Dialog fullWidth maxWidth="sm" onClose={handleClose} open={open}>
      <DialogTitle>New planning session</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography color="text.secondary" variant="body2">
            Describe your idea or feature request. The PO interview workflow will guide you through
            discovery questions, implementation options, and a structured work item draft.
          </Typography>
          <TextField
            disabled={busy}
            error={error !== null}
            helperText={error ?? "Be as specific or vague as you like — the workflow will help clarify."}
            label="What do you want to explore or build?"
            maxRows={8}
            minRows={3}
            multiline
            onChange={(e) => { setIdea(e.target.value); }}
            placeholder="e.g. I want users to be able to filter the backlog by label..."
            value={idea}
          />
          {projects.length > 0 ? (
            <TextField
              disabled={busy}
              label="Project"
              onChange={(e) => { setProjectKey(e.target.value); }}
              select
              value={projectKey}
            >
              {projects.map((project) => (
                <MenuItem key={project.key} value={project.key}>{project.name}</MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={handleClose}>Cancel</Button>
        <Button
          disabled={busy || idea.trim().length === 0}
          onClick={() => { void handleStart(); }}
          startIcon={<AutoAwesomeRoundedIcon />}
          variant="contained"
        >
          {busy ? "Starting…" : "Start session"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
