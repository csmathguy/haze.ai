import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { alpha, styled, useTheme } from "@mui/material/styles";
import type { WorkItem, WorkItemStatus } from "@taxes/shared";

const BOARD_COLUMNS: readonly {
  description: string;
  status: WorkItemStatus;
  title: string;
}[] = [
  { description: "Needs shaping", status: "backlog", title: "Backlog" },
  { description: "In definition", status: "planning", title: "Planning" },
  { description: "Ready to pull", status: "ready", title: "Ready" },
  { description: "Actively moving", status: "in-progress", title: "In progress" },
  { description: "Waiting on a blocker", status: "blocked", title: "Blocked" },
  { description: "Closed out", status: "done", title: "Done" },
  { description: "Hidden from the main flow", status: "archived", title: "Archived" }
] as const;

interface WorkItemBoardProps {
  readonly onSelect: (workItemId: string) => void;
  readonly selectedWorkItemId: string | null;
  readonly workItems: WorkItem[];
}

export function WorkItemBoard({ onSelect, selectedWorkItemId, workItems }: WorkItemBoardProps) {
  const theme = useTheme();

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h2">Kanban board</Typography>
        <Typography color="text.secondary">
          Click any card to open the full brief in a drawer while keeping the board visible underneath.
        </Typography>
      </Stack>
      {workItems.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">No work items match the current project scope.</Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            overflowX: "auto",
            pb: 1
          }}
        >
          <Stack alignItems="stretch" direction="row" spacing={2} sx={{ minWidth: "max-content" }}>
            {BOARD_COLUMNS.map((column) => {
              const columnItems = workItems.filter((workItem) => workItem.status === column.status);

              return (
                <Paper
                  key={column.status}
                  sx={{
                    backgroundColor: alpha(theme.palette.background.paper, 0.84),
                    minHeight: 440,
                    p: 2,
                    width: 312
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Stack spacing={0.5}>
                        <Typography variant="h3">{column.title}</Typography>
                        <Typography color="text.secondary" variant="body2">
                          {column.description}
                        </Typography>
                      </Stack>
                      <Chip label={columnItems.length} size="small" />
                    </Stack>
                    <Stack spacing={1.5}>
                      {columnItems.length === 0 ? (
                        <EmptyColumnState title={column.title} />
                      ) : (
                        columnItems.map((workItem) => (
                          <WorkItemBoardCard
                            key={workItem.id}
                            onSelect={onSelect}
                            selected={selectedWorkItemId === workItem.id}
                            workItem={workItem}
                          />
                        ))
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}

function WorkItemBoardCard({
  onSelect,
  selected,
  workItem
}: {
  readonly onSelect: (workItemId: string) => void;
  readonly selected: boolean;
  readonly workItem: WorkItem;
}) {
  const theme = useTheme();

  return (
    <BoardCard
      onClick={() => {
        onSelect(workItem.id);
      }}
      role="button"
      selected={selected ? 1 : 0}
      sx={{
        "&:hover": {
          borderColor: alpha(theme.palette.primary.main, 0.4),
          transform: "translateY(-1px)"
        }
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="body2">{workItem.id}</Typography>
          <Chip label={renderTaskProgress(workItem)} size="small" />
        </Stack>
        <Typography variant="h3">{workItem.title}</Typography>
        <Typography color="text.secondary" variant="body2">
          {workItem.summary}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip color="primary" label={workItem.projectKey} size="small" />
          <Chip label={workItem.kind} size="small" />
          <Chip label={workItem.priority} size="small" />
        </Stack>
      </Stack>
    </BoardCard>
  );
}

function EmptyColumnState({ title }: { readonly title: string }) {
  return (
    <Paper
      sx={{
        borderRadius: 4,
        p: 2
      }}
    >
      <Typography color="text.secondary" variant="body2">
        No items in {title.toLowerCase()}.
      </Typography>
    </Paper>
  );
}

function renderTaskProgress(workItem: WorkItem): string {
  const completedTasks = workItem.tasks.filter((task) => task.status === "done").length;
  return `${String(completedTasks)}/${String(workItem.tasks.length)} tasks`;
}

const BoardCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "selected"
})<{ readonly selected: 0 | 1 }>(({ selected, theme }) => ({
  backgroundColor: selected ? alpha(theme.palette.primary.main, 0.12) : theme.palette.background.paper,
  borderColor: selected ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.08),
  borderRadius: 32,
  cursor: "pointer",
  padding: 16,
  textAlign: "left",
  transition: "transform 120ms ease, border-color 120ms ease, background-color 120ms ease",
  width: "100%"
}));
