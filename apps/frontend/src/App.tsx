import { Box, Container, Stack } from "@mui/material";
import { AppShellHeader } from "./components/AppShellHeader";
import { DashboardView } from "./components/DashboardView";
import { KanbanView } from "./components/KanbanView";
import { ProjectsView } from "./components/ProjectsView";
import { useAppView } from "./hooks/useAppView";

export function App() {
  const { activeView, navigateToView } = useAppView();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 4, md: 8 },
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: "\"\"",
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 85% 5%, rgba(30, 144, 255, 0.18), transparent 45%), radial-gradient(circle at 10% 95%, rgba(26, 163, 122, 0.2), transparent 35%)"
        }
      }}
    >
      <Container
        data-testid="app-shell"
        maxWidth={false}
        disableGutters
        sx={{
          position: "relative",
          zIndex: 1,
          px: { xs: 2, sm: 3, md: 4 }
        }}
      >
        <Stack spacing={3}>
          <AppShellHeader activeView={activeView} onNavigate={navigateToView} />

          {activeView === "dashboard" && <DashboardView />}
          {activeView === "kanban" && <KanbanView />}
          {activeView === "projects" && <ProjectsView />}
        </Stack>
      </Container>
    </Box>
  );
}
