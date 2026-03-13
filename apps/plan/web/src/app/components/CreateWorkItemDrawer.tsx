import type { CreateWorkItemDraftInput, PlanningProject } from "@taxes/shared";

import { CreateWorkItemForm } from "./CreateWorkItemForm.js";
import { PlanningSurfaceDrawer } from "./PlanningSurfaceDrawer.js";

interface CreateWorkItemDrawerProps {
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateWorkItemDraftInput) => Promise<boolean>;
  readonly open: boolean;
  readonly projects: PlanningProject[];
}

export function CreateWorkItemDrawer({ onClose, onSubmit, open, projects }: CreateWorkItemDrawerProps) {
  return (
    <PlanningSurfaceDrawer
      description="Capture the next piece of work without losing your place in the desk."
      onClose={onClose}
      open={open}
      title="New work item"
    >
      <CreateWorkItemForm
        disabled={false}
        onSubmit={onSubmit}
        projects={projects}
        showTitle={false}
        submitLabel="Create work item"
        surface="plain"
      />
    </PlanningSurfaceDrawer>
  );
}
