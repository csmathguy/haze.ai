import type { ReactNode } from "react";
import { Alert, CircularProgress, Grid, Stack } from "@mui/material";
import type { CreateWorkItemDraftInput, PlanningWorkspace, WorkItemStatus } from "@taxes/shared";

import { CreateWorkItemForm } from "./CreateWorkItemForm.js";
import { WorkItemDetail } from "./WorkItemDetail.js";
import { WorkItemList } from "./WorkItemList.js";
import { WorkspaceSummary } from "./WorkspaceSummary.js";

interface PlanningWorkspaceStateProps {
  readonly handleCreateWorkItem: (input: CreateWorkItemDraftInput) => Promise<void>;
  readonly handleCriterionToggle: (criterionId: string, checked: boolean) => Promise<void>;
  readonly handleStatusChange: (status: WorkItemStatus) => Promise<void>;
  readonly handleTaskToggle: (taskId: string, checked: boolean) => Promise<void>;
  readonly isBusy: boolean;
  readonly projectScopeBar: ReactNode;
  readonly selectedWorkItem: PlanningWorkspace["workItems"][number] | null;
  readonly selectedWorkItemId: string | null;
  readonly setSelectedWorkItemId: (workItemId: string | null) => void;
  readonly visibleWorkItems: PlanningWorkspace["workItems"];
  readonly workspace: PlanningWorkspace | null;
}

export function PlanningWorkspaceState({
  handleCreateWorkItem,
  handleCriterionToggle,
  handleStatusChange,
  handleTaskToggle,
  isBusy,
  projectScopeBar,
  selectedWorkItem,
  selectedWorkItemId,
  setSelectedWorkItemId,
  visibleWorkItems,
  workspace
}: PlanningWorkspaceStateProps) {
  if (isBusy) {
    return (
      <Stack alignItems="center" minHeight={320} justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  if (workspace === null) {
    return (
      <Alert severity="warning">
        Planning data is unavailable. Refresh after the plan API is running and serving the current workspace schema.
      </Alert>
    );
  }

  return (
    <>
      <WorkspaceSummary workspace={workspace} />
      {projectScopeBar}
      <Grid container spacing={2}>
        <Grid size={{ lg: 5, xs: 12 }}>
          <CreateWorkItemForm disabled={false} onSubmit={handleCreateWorkItem} projects={workspace.projects} />
        </Grid>
        <Grid size={{ lg: 7, xs: 12 }}>
          <WorkItemDetail
            onCriterionToggle={handleCriterionToggle}
            onStatusChange={handleStatusChange}
            onTaskToggle={handleTaskToggle}
            workItem={selectedWorkItem}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <WorkItemList
            onSelect={setSelectedWorkItemId}
            selectedWorkItemId={selectedWorkItemId}
            workItems={visibleWorkItems}
          />
        </Grid>
      </Grid>
    </>
  );
}
