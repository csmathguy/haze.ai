import { startTransition, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Container,
  Stack,
  Typography
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CreateWorkItemDraftInput, PlanningWorkspace, WorkItemStatus } from "@taxes/shared";

import {
  createPlanningWorkItem,
  fetchPlanningWorkspace,
  updatePlanningAcceptanceCriterionStatus,
  updatePlanningTaskStatus,
  updatePlanningWorkItem
} from "./api.js";
import { PlanningWorkspaceState } from "./components/PlanningWorkspaceState.js";

export function App() {
  const {
    errorMessage,
    handleCreateWorkItem,
    handleCriterionToggle,
    handlePlanningSessionStarted,
    handleStatusChange,
    handleTaskToggle,
    isBusy,
    selectedProjectKey,
    selectedWorkItem,
    selectedWorkItemId,
    setSelectedProjectKey,
    setSelectedWorkItemId,
    successMessage,
    visibleWorkItems,
    workspace
  } = usePlanningWorkspaceController();

  return (
    <PlanningPageLayout
      errorMessage={errorMessage}
      handleCreateWorkItem={handleCreateWorkItem}
      handleCriterionToggle={handleCriterionToggle}
      handlePlanningSessionStarted={handlePlanningSessionStarted}
      handleStatusChange={handleStatusChange}
      handleTaskToggle={handleTaskToggle}
      isBusy={isBusy}
      selectedProjectKey={selectedProjectKey}
      selectedWorkItem={selectedWorkItem}
      selectedWorkItemId={selectedWorkItemId}
      setSelectedProjectKey={setSelectedProjectKey}
      setSelectedWorkItemId={setSelectedWorkItemId}
      successMessage={successMessage}
      visibleWorkItems={visibleWorkItems}
      workspace={workspace}
    />
  );
}

function usePlanningWorkspaceController() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [selectedProjectKey, setSelectedProjectKey] = useState("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<PlanningWorkspace | null>(null);
  const visibleWorkItems =
    workspace === null || selectedProjectKey === "all"
      ? workspace?.workItems ?? []
      : workspace.workItems.filter((workItem) => workItem.projectKey === selectedProjectKey);
  const {
    selectedWorkItem,
    selectedWorkItemId,
    setSelectedWorkItemId
  } = useSelectedWorkItem(visibleWorkItems);

  useEffect(() => {
    void refreshWorkspace();
  }, []);

  async function refreshWorkspace(): Promise<void> {
    setIsBusy(true);
    setErrorMessage(null);

    try {
      const nextWorkspace = await fetchPlanningWorkspace();

      startTransition(() => {
        setWorkspace(nextWorkspace);
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load the planning workspace.");
    } finally {
      setIsBusy(false);
    }
  }

  const {
    handleCreateWorkItem,
    handleCriterionToggle,
    handleStatusChange,
    handleTaskToggle
  } = usePlanningActions({
    refreshWorkspace,
    selectedWorkItemId,
    setErrorMessage,
    setSuccessMessage
  });

  function handlePlanningSessionStarted(runId: string): void {
    setSuccessMessage(`Planning session started (run ${runId}). Open the workflow app to follow along.`);
  }

  return {
    errorMessage,
    handleCreateWorkItem,
    handleCriterionToggle,
    handlePlanningSessionStarted,
    handleStatusChange,
    handleTaskToggle,
    isBusy,
    selectedProjectKey,
    selectedWorkItem,
    selectedWorkItemId,
    setSelectedProjectKey,
    setSelectedWorkItemId,
    successMessage,
    visibleWorkItems,
    workspace
  };
}

function useSelectedWorkItem(workItems: PlanningWorkspace["workItems"]) {
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);

  useEffect(() => {
    if (workItems.length === 0) {
      setSelectedWorkItemId(null);
      return;
    }

    if (selectedWorkItemId !== null && workItems.every((item) => item.id !== selectedWorkItemId)) {
      setSelectedWorkItemId(null);
    }
  }, [selectedWorkItemId, workItems]);

  return {
    selectedWorkItem: workItems.find((workItem) => workItem.id === selectedWorkItemId) ?? null,
    selectedWorkItemId,
    setSelectedWorkItemId
  };
}

interface PlanningActionsOptions {
  readonly refreshWorkspace: () => Promise<void>;
  readonly selectedWorkItemId: string | null;
  readonly setErrorMessage: (message: string | null) => void;
  readonly setSuccessMessage: (message: string | null) => void;
}

function usePlanningActions({
  refreshWorkspace,
  selectedWorkItemId,
  setErrorMessage,
  setSuccessMessage
}: PlanningActionsOptions) {
  async function handleCreateWorkItem(input: CreateWorkItemDraftInput): Promise<boolean> {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await createPlanningWorkItem(input);
      setSuccessMessage("Planning work item saved.");
      await refreshWorkspace();
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save planning work item.");
      return false;
    }
  }

  async function handleStatusChange(status: WorkItemStatus): Promise<void> {
    if (selectedWorkItemId === null) {
      return;
    }

    await runWorkspaceMutation({
      action: async () => {
        await updatePlanningWorkItem(selectedWorkItemId, { status });
      },
      refreshWorkspace,
      setErrorMessage,
      setSuccessMessage,
      successMessage: "Planning status updated."
    });
  }

  async function handleTaskToggle(taskId: string, checked: boolean): Promise<void> {
    if (selectedWorkItemId === null) {
      return;
    }

    await runWorkspaceMutation({
      action: async () => {
        await updatePlanningTaskStatus(selectedWorkItemId, taskId, {
          status: checked ? "done" : "todo"
        });
      },
      refreshWorkspace,
      setErrorMessage,
      setSuccessMessage,
      successMessage: "Task progress updated."
    });
  }

  async function handleCriterionToggle(criterionId: string, checked: boolean): Promise<void> {
    if (selectedWorkItemId === null) {
      return;
    }

    await runWorkspaceMutation({
      action: async () => {
        await updatePlanningAcceptanceCriterionStatus(selectedWorkItemId, criterionId, {
          status: checked ? "passed" : "pending"
        });
      },
      refreshWorkspace,
      setErrorMessage,
      setSuccessMessage,
      successMessage: "Acceptance criteria updated."
    });
  }

  return {
    handleCreateWorkItem,
    handleCriterionToggle,
    handleStatusChange,
    handleTaskToggle
  };
}

interface WorkspaceMutationOptions {
  readonly action: () => Promise<void>;
  readonly refreshWorkspace: () => Promise<void>;
  readonly setErrorMessage: (message: string | null) => void;
  readonly setSuccessMessage: (message: string | null) => void;
  readonly successMessage: string;
}

async function runWorkspaceMutation(options: WorkspaceMutationOptions): Promise<void> {
  options.setErrorMessage(null);
  options.setSuccessMessage(null);

  try {
    await options.action();
    options.setSuccessMessage(options.successMessage);
    await options.refreshWorkspace();
  } catch (error) {
    options.setErrorMessage(error instanceof Error ? error.message : "Planning update failed.");
  }
}

interface PlanningPageLayoutProps {
  readonly errorMessage: string | null;
  readonly handleCreateWorkItem: (input: CreateWorkItemDraftInput) => Promise<boolean>;
  readonly handleCriterionToggle: (criterionId: string, checked: boolean) => Promise<void>;
  readonly handlePlanningSessionStarted: (runId: string) => void;
  readonly handleStatusChange: (status: WorkItemStatus) => Promise<void>;
  readonly handleTaskToggle: (taskId: string, checked: boolean) => Promise<void>;
  readonly isBusy: boolean;
  readonly selectedProjectKey: string;
  readonly selectedWorkItem: PlanningWorkspace["workItems"][number] | null;
  readonly selectedWorkItemId: string | null;
  readonly setSelectedProjectKey: (projectKey: string) => void;
  readonly setSelectedWorkItemId: (workItemId: string | null) => void;
  readonly successMessage: string | null;
  readonly visibleWorkItems: PlanningWorkspace["workItems"];
  readonly workspace: PlanningWorkspace | null;
}

function PlanningPageLayout({
  errorMessage,
  handleCreateWorkItem,
  handleCriterionToggle,
  handlePlanningSessionStarted,
  handleStatusChange,
  handleTaskToggle,
  isBusy,
  selectedProjectKey,
  selectedWorkItem,
  selectedWorkItemId,
  setSelectedProjectKey,
  setSelectedWorkItemId,
  successMessage,
  visibleWorkItems,
  workspace
}: PlanningPageLayoutProps) {
  return (
    <Box
      sx={(theme) => ({
        background: `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.12)}, transparent 30%), linear-gradient(130deg, ${alpha(theme.palette.primary.main, 0.08)}, transparent 60%)`,
        minHeight: "100vh",
        py: 3.5
      })}
    >
      <Container maxWidth="xl">
        <Stack spacing={2.5}>
          <Stack spacing={0.75}>
            <Typography variant="h1">Planning Desk</Typography>
            <Typography maxWidth={760} variant="body2">
              Keep the autonomous workflow grounded in explicit backlog items, acceptance criteria, plan steps, and audit references that survive across worktrees.
            </Typography>
          </Stack>
          {successMessage !== null ? <Alert severity="success">{successMessage}</Alert> : null}
          {errorMessage !== null ? <Alert severity="error">{errorMessage}</Alert> : null}
          <PlanningWorkspaceState
            handleCreateWorkItem={handleCreateWorkItem}
            handleCriterionToggle={handleCriterionToggle}
            handlePlanningSessionStarted={handlePlanningSessionStarted}
            handleStatusChange={handleStatusChange}
            handleTaskToggle={handleTaskToggle}
            isBusy={isBusy}
            projects={workspace?.projects ?? []}
            selectedProjectKey={selectedProjectKey}
            selectedWorkItem={selectedWorkItem}
            selectedWorkItemId={selectedWorkItemId}
            setSelectedProjectKey={setSelectedProjectKey}
            setSelectedWorkItemId={setSelectedWorkItemId}
            visibleWorkItems={visibleWorkItems}
            workspace={workspace}
          />
        </Stack>
      </Container>
    </Box>
  );
}
