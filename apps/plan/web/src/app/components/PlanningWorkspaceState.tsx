import { useEffect, useState } from "react";
import { Alert, CircularProgress, Grid, Stack, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { CreateWorkItemDraftInput, PlanningWorkspace, WorkItemStatus } from "@taxes/shared";

import { CreateWorkItemDrawer } from "./CreateWorkItemDrawer.js";
import { PlanningWorkspaceToolbar } from "./PlanningWorkspaceToolbar.js";
import { ResponsiveWorkItemDetail } from "./ResponsiveWorkItemDetail.js";
import { WorkItemList } from "./WorkItemList.js";
import { WorkspaceSummary } from "./WorkspaceSummary.js";

interface PlanningWorkspaceStateProps {
  readonly handleCreateWorkItem: (input: CreateWorkItemDraftInput) => Promise<boolean>;
  readonly handleCriterionToggle: (criterionId: string, checked: boolean) => Promise<void>;
  readonly handleStatusChange: (status: WorkItemStatus) => Promise<void>;
  readonly handleTaskToggle: (taskId: string, checked: boolean) => Promise<void>;
  readonly isBusy: boolean;
  readonly projects: PlanningWorkspace["projects"];
  readonly selectedProjectKey: string;
  readonly selectedWorkItem: PlanningWorkspace["workItems"][number] | null;
  readonly selectedWorkItemId: string | null;
  readonly setSelectedProjectKey: (projectKey: string) => void;
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
  projects,
  selectedProjectKey,
  selectedWorkItem,
  selectedWorkItemId,
  setSelectedProjectKey,
  setSelectedWorkItemId,
  visibleWorkItems,
  workspace
}: PlanningWorkspaceStateProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setIsDetailDrawerOpen(false);
    }
  }, [isMobile]);

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
    <PlanningWorkspaceReadyState
      handleCreateWorkItem={handleCreateWorkItem}
      handleCriterionToggle={handleCriterionToggle}
      handleStatusChange={handleStatusChange}
      handleTaskToggle={handleTaskToggle}
      isCreateDrawerOpen={isCreateDrawerOpen}
      isDetailDrawerOpen={isDetailDrawerOpen}
      isMobile={isMobile}
      projects={projects}
      selectedProjectKey={selectedProjectKey}
      selectedWorkItem={selectedWorkItem}
      selectedWorkItemId={selectedWorkItemId}
      setIsCreateDrawerOpen={setIsCreateDrawerOpen}
      setIsDetailDrawerOpen={setIsDetailDrawerOpen}
      setSelectedProjectKey={setSelectedProjectKey}
      setSelectedWorkItemId={setSelectedWorkItemId}
      visibleWorkItems={visibleWorkItems}
      workspace={workspace}
    />
  );
}

interface PlanningWorkspaceReadyStateProps extends Omit<PlanningWorkspaceStateProps, "isBusy" | "workspace"> {
  readonly isCreateDrawerOpen: boolean;
  readonly isDetailDrawerOpen: boolean;
  readonly isMobile: boolean;
  readonly setIsCreateDrawerOpen: (open: boolean) => void;
  readonly setIsDetailDrawerOpen: (open: boolean) => void;
  readonly workspace: PlanningWorkspace;
}

function PlanningWorkspaceReadyState({
  handleCreateWorkItem,
  handleCriterionToggle,
  handleStatusChange,
  handleTaskToggle,
  isCreateDrawerOpen,
  isDetailDrawerOpen,
  isMobile,
  projects,
  selectedProjectKey,
  selectedWorkItem,
  selectedWorkItemId,
  setIsCreateDrawerOpen,
  setIsDetailDrawerOpen,
  setSelectedProjectKey,
  setSelectedWorkItemId,
  visibleWorkItems,
  workspace
}: PlanningWorkspaceReadyStateProps) {
  async function handleCreateDrawerSubmit(input: CreateWorkItemDraftInput): Promise<boolean> {
    const wasSaved = await handleCreateWorkItem(input);

    if (wasSaved) {
      setIsCreateDrawerOpen(false);
    }

    return wasSaved;
  }

  return (
    <>
      <WorkspaceSummary workspace={workspace} />
      <PlanningWorkspaceToolbar
        onCreateWorkItem={() => {
          setIsCreateDrawerOpen(true);
        }}
        projects={projects}
        selectedProjectKey={selectedProjectKey}
        totalVisibleItems={visibleWorkItems.length}
        setSelectedProjectKey={setSelectedProjectKey}
      />
      <CreateWorkItemDrawer
        onClose={() => {
          setIsCreateDrawerOpen(false);
        }}
        onSubmit={handleCreateDrawerSubmit}
        open={isCreateDrawerOpen}
        projects={workspace.projects}
      />
      <PlanningWorkspaceBody
        handleCriterionToggle={handleCriterionToggle}
        handleStatusChange={handleStatusChange}
        handleTaskToggle={handleTaskToggle}
        isDetailDrawerOpen={isDetailDrawerOpen}
        isMobile={isMobile}
        selectedWorkItem={selectedWorkItem}
        selectedWorkItemId={selectedWorkItemId}
        setIsDetailDrawerOpen={setIsDetailDrawerOpen}
        setSelectedWorkItemId={setSelectedWorkItemId}
        visibleWorkItems={visibleWorkItems}
      />
    </>
  );
}

interface PlanningWorkspaceBodyProps {
  readonly handleCriterionToggle: (criterionId: string, checked: boolean) => Promise<void>;
  readonly handleStatusChange: (status: WorkItemStatus) => Promise<void>;
  readonly handleTaskToggle: (taskId: string, checked: boolean) => Promise<void>;
  readonly isDetailDrawerOpen: boolean;
  readonly isMobile: boolean;
  readonly selectedWorkItem: PlanningWorkspace["workItems"][number] | null;
  readonly selectedWorkItemId: string | null;
  readonly setIsDetailDrawerOpen: (open: boolean) => void;
  readonly setSelectedWorkItemId: (workItemId: string | null) => void;
  readonly visibleWorkItems: PlanningWorkspace["workItems"];
}

function PlanningWorkspaceBody({
  handleCriterionToggle,
  handleStatusChange,
  handleTaskToggle,
  isDetailDrawerOpen,
  isMobile,
  selectedWorkItem,
  selectedWorkItemId,
  setIsDetailDrawerOpen,
  setSelectedWorkItemId,
  visibleWorkItems
}: PlanningWorkspaceBodyProps) {
  return (
    <>
      <Grid container spacing={2}>
        <Grid size={{ lg: 5, xs: 12 }}>
          <WorkItemList
            onSelect={(workItemId) => {
              setSelectedWorkItemId(workItemId);

              if (isMobile) {
                setIsDetailDrawerOpen(true);
              }
            }}
            selectedWorkItemId={selectedWorkItemId}
            workItems={visibleWorkItems}
          />
        </Grid>
        {!isMobile ? (
          <Grid size={{ lg: 7, xs: 12 }}>
            <ResponsiveWorkItemDetail
              mobile={false}
              onClose={() => {
                setIsDetailDrawerOpen(false);
              }}
              onCriterionToggle={handleCriterionToggle}
              onStatusChange={handleStatusChange}
              onTaskToggle={handleTaskToggle}
              open
              workItem={selectedWorkItem}
            />
          </Grid>
        ) : null}
      </Grid>
      {isMobile ? (
        <ResponsiveWorkItemDetail
          mobile
          onClose={() => {
            setIsDetailDrawerOpen(false);
          }}
          onCriterionToggle={handleCriterionToggle}
          onStatusChange={handleStatusChange}
          onTaskToggle={handleTaskToggle}
          open={isDetailDrawerOpen}
          workItem={selectedWorkItem}
        />
      ) : null}
    </>
  );
}
