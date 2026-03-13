import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { CreateWorkItemDraftInput, PlanningProject } from "@taxes/shared";

import { CreateWorkItemForm } from "./CreateWorkItemForm.js";

interface CreateWorkItemDrawerProps {
  readonly onClose: () => void;
  readonly onSubmit: (input: CreateWorkItemDraftInput) => Promise<boolean>;
  readonly open: boolean;
  readonly projects: PlanningProject[];
}

export function CreateWorkItemDrawer({ onClose, onSubmit, open, projects }: CreateWorkItemDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Drawer
      ModalProps={{ keepMounted: true }}
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: isMobile ? 28 : 0,
            borderTopRightRadius: isMobile ? 28 : 0,
            p: 3,
            width: { md: 560, xs: "100%" }
          }
        }
      }}
      anchor={isMobile ? "bottom" : "right"}
      onClose={onClose}
      open={open}
    >
      <Stack spacing={3}>
        <Stack alignItems="start" direction="row" justifyContent="space-between" spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h2">New work item</Typography>
            <Typography color="text.secondary">
              Capture the next piece of work without losing your place in the desk.
            </Typography>
          </Stack>
          <IconButton aria-label="Close create work item drawer" onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        <CreateWorkItemForm
          disabled={false}
          onSubmit={onSubmit}
          projects={projects}
          showTitle={false}
          submitLabel="Create work item"
          surface="plain"
        />
      </Stack>
    </Drawer>
  );
}
