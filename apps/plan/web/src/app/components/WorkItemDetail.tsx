import {
  Checkbox,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { WorkItem, WorkItemStatus } from "@taxes/shared";

interface WorkItemDetailProps {
  readonly onCriterionToggle: (criterionId: string, isPassed: boolean) => Promise<void>;
  readonly onStatusChange: (status: WorkItemStatus) => Promise<void>;
  readonly onTaskToggle: (taskId: string, isDone: boolean) => Promise<void>;
  readonly surface?: "paper" | "plain";
  readonly workItem: WorkItem | null;
}

export function WorkItemDetail({
  onCriterionToggle,
  onStatusChange,
  onTaskToggle,
  surface = "paper",
  workItem
}: WorkItemDetailProps) {
  if (workItem === null) {
    return (
      <Paper sx={{ minHeight: 360, p: 3 }}>
        <Typography color="text.secondary" variant="body2">
          Select a work item to inspect its tasks, criteria, and plan steps.
        </Typography>
      </Paper>
    );
  }

  const content = (
    <Stack spacing={2.5}>
      <WorkItemHeader onStatusChange={onStatusChange} workItem={workItem} />
      <Divider />
      <ChecklistSection
        emptyMessage="No tasks yet."
        items={workItem.tasks.map((task) => ({
          checked: task.status === "done",
          id: task.id,
          label: task.title
        }))}
        onToggle={onTaskToggle}
        title="Tasks"
      />
      <ChecklistSection
        emptyMessage="No acceptance criteria yet."
        items={workItem.acceptanceCriteria.map((criterion) => ({
          checked: criterion.status === "passed",
          id: criterion.id,
          label: criterion.title
        }))}
        onToggle={onCriterionToggle}
        title="Acceptance criteria"
      />
      <Divider />
      <LatestPlanSection workItem={workItem} />
    </Stack>
  );

  if (surface === "plain") {
    return content;
  }

  return <Paper sx={{ p: 3 }}>{content}</Paper>;
}

function WorkItemHeader({
  onStatusChange,
  workItem
}: Pick<WorkItemDetailProps, "onStatusChange"> & { readonly workItem: WorkItem }) {
  return (
    <Stack spacing={1.5}>
      <Stack spacing={1}>
        <Typography variant="h3">{workItem.title}</Typography>
        <Typography color="text.secondary" variant="body2">
          {workItem.summary}
        </Typography>
        <WorkItemMetaChips workItem={workItem} />
      </Stack>
      <TextField
        label="Status"
        onChange={(event) => {
          void onStatusChange(event.target.value as WorkItemStatus);
        }}
        select
        sx={{ maxWidth: 240, width: { sm: 240, xs: "100%" } }}
        value={workItem.status}
      >
        {["backlog", "planning", "ready", "in-progress", "blocked", "done", "archived"].map((status) => (
          <MenuItem key={status} value={status}>
            {status}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

function WorkItemMetaChips({ workItem }: { readonly workItem: WorkItem }) {
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      <Chip label={workItem.id} />
      <Chip color="primary" label={workItem.projectKey} />
      <Chip label={workItem.kind} />
      <Chip label={workItem.priority} />
      <Chip label={`${workItem.tasks.length.toString()} tasks`} variant="outlined" />
      <Chip label={`${workItem.acceptanceCriteria.length.toString()} criteria`} variant="outlined" />
      {workItem.targetIteration !== undefined ? <Chip label={workItem.targetIteration} /> : null}
      {workItem.auditWorkflowRunId !== undefined ? <Chip color="secondary" label={workItem.auditWorkflowRunId} /> : null}
    </Stack>
  );
}

function LatestPlanSection({ workItem }: { readonly workItem: WorkItem }) {
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Latest plan</Typography>
      {workItem.planRuns[0] === undefined ? (
        <Typography color="text.secondary" variant="body2">
          No stored plan run yet.
        </Typography>
      ) : (
        <List disablePadding>
          {workItem.planRuns[0].steps.map((step) => (
            <ListItem key={step.id} disableGutters>
              <ListItemText primary={step.title} secondary={`${step.phase} - ${step.status}`} />
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}

interface ChecklistSectionProps {
  readonly emptyMessage: string;
  readonly items: readonly {
    checked: boolean;
    id: string;
    label: string;
  }[];
  readonly onToggle: (itemId: string, checked: boolean) => Promise<void>;
  readonly title: string;
}

function ChecklistSection({ emptyMessage, items, onToggle, title }: ChecklistSectionProps) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="h4">{title}</Typography>
        <Chip label={items.length.toString()} size="small" variant="outlined" />
      </Stack>
      {items.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          {emptyMessage}
        </Typography>
      ) : (
        <List disablePadding>
          {items.map((item) => (
            <ListItem key={item.id} disableGutters>
              <Checkbox
                checked={item.checked}
                onChange={(_event, checked) => {
                  void onToggle(item.id, checked);
                }}
              />
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      )}
    </Stack>
  );
}
