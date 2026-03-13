import {
  Chip,
  List,
  ListItemButton,
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
        <Stack spacing={0.5}>
          <Typography variant="h2">Work items</Typography>
          <Typography color="text.secondary">
            Select an item to inspect it without losing context.
          </Typography>
        </Stack>
        {workItems.length === 0 ? (
          <Typography color="text.secondary">No work items match the current project scope.</Typography>
        ) : (
          <List disablePadding>
            {workItems.map((workItem) => (
              <ListItemButton
                key={workItem.id}
                onClick={() => {
                  onSelect(workItem.id);
                }}
                selected={selectedWorkItemId === workItem.id}
                sx={{ alignItems: "flex-start", borderRadius: 3, mb: 1, py: 1.5 }}
              >
                <Stack spacing={1} width="100%">
                  <Stack
                    direction={{ sm: "row", xs: "column" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography variant="h3">{workItem.title}</Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip label={workItem.status} size="small" />
                      <Chip label={renderTaskProgress(workItem)} size="small" />
                    </Stack>
                  </Stack>
                  <Typography color="text.secondary">{workItem.summary}</Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip label={workItem.id} size="small" />
                    <Chip label={workItem.projectKey} size="small" />
                    <Chip label={workItem.kind} size="small" />
                    <Chip label={workItem.priority} size="small" />
                  </Stack>
                </Stack>
              </ListItemButton>
            ))}
          </List>
        )}
      </Stack>
    </Paper>
  );
}

function renderTaskProgress(workItem: WorkItem): string {
  const completedTasks = workItem.tasks.filter((task) => task.status === "done").length;
  return `${String(completedTasks)}/${String(workItem.tasks.length)} tasks`;
}
