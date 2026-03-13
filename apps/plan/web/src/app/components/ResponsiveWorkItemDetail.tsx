import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Drawer,
  IconButton,
  Stack,
  Typography
} from "@mui/material";
import type { WorkItem, WorkItemStatus } from "@taxes/shared";

import { WorkItemDetail } from "./WorkItemDetail.js";

interface ResponsiveWorkItemDetailProps {
  readonly mobile: boolean;
  readonly onClose: () => void;
  readonly onCriterionToggle: (criterionId: string, isPassed: boolean) => Promise<void>;
  readonly onStatusChange: (status: WorkItemStatus) => Promise<void>;
  readonly onTaskToggle: (taskId: string, isDone: boolean) => Promise<void>;
  readonly open: boolean;
  readonly workItem: WorkItem | null;
}

export function ResponsiveWorkItemDetail({
  mobile,
  onClose,
  onCriterionToggle,
  onStatusChange,
  onTaskToggle,
  open,
  workItem
}: ResponsiveWorkItemDetailProps) {
  if (!mobile) {
    return (
      <Stack sx={{ position: { lg: "sticky" }, top: { lg: 24 } }}>
        <WorkItemDetail
          onCriterionToggle={onCriterionToggle}
          onStatusChange={onStatusChange}
          onTaskToggle={onTaskToggle}
          workItem={workItem}
        />
      </Stack>
    );
  }

  return (
    <Drawer
      ModalProps={{ keepMounted: true }}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: "88vh",
            p: 2.5
          }
        }
      }}
      anchor="bottom"
      onClose={onClose}
      open={open && workItem !== null}
    >
      <Stack spacing={2}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
          <Typography variant="h3">Work item detail</Typography>
          <IconButton aria-label="Close work item detail" onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        <WorkItemDetail
          onCriterionToggle={onCriterionToggle}
          onStatusChange={onStatusChange}
          onTaskToggle={onTaskToggle}
          workItem={workItem}
        />
      </Stack>
    </Drawer>
  );
}
