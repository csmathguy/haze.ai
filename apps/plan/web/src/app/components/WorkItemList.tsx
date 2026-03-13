import {
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import type { WorkItem } from "@taxes/shared";

interface WorkItemListProps {
  readonly onSelect: (workItemId: string) => void;
  readonly selectedWorkItemId: string | null;
  readonly workItems: WorkItem[];
}

export function WorkItemList({ onSelect, selectedWorkItemId, workItems }: WorkItemListProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h2">Backlog</Typography>
        <List disablePadding>
          {workItems.map((workItem) => (
            <ListItemButton
              key={workItem.id}
              onClick={() => {
                onSelect(workItem.id);
              }}
              selected={selectedWorkItemId === workItem.id}
              sx={{ borderRadius: 3, mb: 1 }}
            >
              <ListItemText primary={workItem.title} secondary={renderWorkItemSummary(workItem)} />
              <Stack direction="row" spacing={1}>
                <Chip label={workItem.status} size="small" />
                <Chip label={renderTaskProgress(workItem)} size="small" />
              </Stack>
            </ListItemButton>
          ))}
        </List>
      </Stack>
    </Paper>
  );
}

function renderWorkItemSummary(workItem: WorkItem): string {
  return `${workItem.id} - ${workItem.projectKey} - ${workItem.kind} - ${workItem.priority}`;
}

function renderTaskProgress(workItem: WorkItem): string {
  const completedTasks = workItem.tasks.filter((task) => task.status === "done").length;
  return `${String(completedTasks)}/${String(workItem.tasks.length)} tasks`;
}
