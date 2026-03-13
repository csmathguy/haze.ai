import AddRoundedIcon from "@mui/icons-material/AddRounded";
import {
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { PlanningWorkspace } from "@taxes/shared";

interface PlanningWorkspaceToolbarProps {
  readonly onCreateWorkItem: () => void;
  readonly projects: PlanningWorkspace["projects"];
  readonly selectedProjectKey: string;
  readonly setSelectedProjectKey: (projectKey: string) => void;
  readonly totalVisibleItems: number;
}

export function PlanningWorkspaceToolbar({
  onCreateWorkItem,
  projects,
  selectedProjectKey,
  setSelectedProjectKey,
  totalVisibleItems
}: PlanningWorkspaceToolbarProps) {
  return (
    <Stack
      direction={{ lg: "row", xs: "column" }}
      justifyContent="space-between"
      spacing={2}
    >
      <Stack spacing={0.5}>
        <Typography color="text.secondary">
          Review the backlog in one place and open focused surfaces only when you need to create or inspect work.
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {totalVisibleItems.toString()} item(s) in the current scope.
        </Typography>
      </Stack>
      <Stack direction={{ sm: "row", xs: "column" }} spacing={1.5}>
        <TextField
          label="Project scope"
          onChange={(event) => {
            setSelectedProjectKey(event.target.value);
          }}
          select
          sx={{ minWidth: 220 }}
          value={selectedProjectKey}
        >
          <MenuItem value="all">All projects</MenuItem>
          {projects.map((project) => (
            <MenuItem key={project.key} value={project.key}>
              {project.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          onClick={onCreateWorkItem}
          startIcon={<AddRoundedIcon />}
          variant="contained"
        >
          New work item
        </Button>
      </Stack>
    </Stack>
  );
}
