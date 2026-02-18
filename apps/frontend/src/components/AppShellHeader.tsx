import ManageSearchRounded from "@mui/icons-material/ManageSearchRounded";
import ViewKanbanRounded from "@mui/icons-material/ViewKanbanRounded";
import WindowRounded from "@mui/icons-material/WindowRounded";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { AppView } from "../hooks/useAppView";
import { ModeToggle } from "./ModeToggle";

export function AppShellHeader({
  activeView,
  onNavigate
}: {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h3">Haze Agent Monitor</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Orchestrator dashboard and Kanban workflow board for agent execution.
          </Typography>
        </Box>
        <ModeToggle />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button
          variant={activeView === "dashboard" ? "contained" : "outlined"}
          startIcon={<WindowRounded />}
          onClick={() => onNavigate("dashboard")}
        >
          Dashboard
        </Button>
        <Button
          variant={activeView === "kanban" ? "contained" : "outlined"}
          startIcon={<ViewKanbanRounded />}
          onClick={() => onNavigate("kanban")}
        >
          Kanban Board
        </Button>
        <Button
          variant={activeView === "projects" ? "contained" : "outlined"}
          startIcon={<ManageSearchRounded />}
          onClick={() => onNavigate("projects")}
        >
          Projects
        </Button>
      </Stack>
    </>
  );
}
