import type { WorkItem, WorkItemStatus } from "@taxes/shared";

import { PlanningSurfaceDrawer } from "./PlanningSurfaceDrawer.js";
import { WorkItemDetail } from "./WorkItemDetail.js";

interface ResponsiveWorkItemDetailProps {
  readonly onClose: () => void;
  readonly onCriterionToggle: (criterionId: string, isPassed: boolean) => Promise<void>;
  readonly onStatusChange: (status: WorkItemStatus) => Promise<void>;
  readonly onTaskToggle: (taskId: string, isDone: boolean) => Promise<void>;
  readonly open: boolean;
  readonly workItem: WorkItem | null;
}

export function ResponsiveWorkItemDetail({
  onClose,
  onCriterionToggle,
  onStatusChange,
  onTaskToggle,
  open,
  workItem
}: ResponsiveWorkItemDetailProps) {
  return (
    <PlanningSurfaceDrawer
      description={
        workItem === null
          ? "Pick a card from the board to inspect tasks, criteria, and plan steps."
          : "Review tasks, criteria, and the latest plan without leaving the board."
      }
      onClose={onClose}
      open={open && workItem !== null}
      title={workItem?.title ?? "Work item detail"}
    >
      <WorkItemDetail
        onCriterionToggle={onCriterionToggle}
        onStatusChange={onStatusChange}
        onTaskToggle={onTaskToggle}
        surface="plain"
        workItem={workItem}
      />
    </PlanningSurfaceDrawer>
  );
}
