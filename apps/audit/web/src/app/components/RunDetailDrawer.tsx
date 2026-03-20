import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import DragIndicatorOutlinedIcon from "@mui/icons-material/DragIndicatorOutlined";
import OpenInFullOutlinedIcon from "@mui/icons-material/OpenInFullOutlined";
import { Box, Chip, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { AuditRunDetail, AuditWorkItemTimeline } from "@taxes/shared";

import { RunDetail } from "./RunDetail.js";

interface RunDetailDrawerProps {
  readonly detail: AuditRunDetail | null;
  readonly detailError: string | null;
  readonly drawerWidth: number;
  readonly isDrawerOpen: boolean;
  readonly isLoadingDetail: boolean;
  readonly onClose: () => void;
  readonly onResize: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  readonly timeline: AuditWorkItemTimeline | null;
}

export function RunDetailDrawer({
  detail,
  detailError,
  drawerWidth,
  isDrawerOpen,
  isLoadingDetail,
  onClose,
  onResize,
  timeline
}: RunDetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={isDrawerOpen}
      slotProps={{
        paper: {
          sx: {
            borderLeft: "1px solid var(--mui-palette-divider)",
            overflow: "hidden",
            width: drawerWidth
          }
        }
      }}
      variant="persistent"
    >
      <ResizeRail onResize={onResize} width={drawerWidth} />
      <Stack sx={{ height: "100%" }}>
        <DrawerChrome detailError={detailError} drawerWidth={drawerWidth} isLoadingDetail={isLoadingDetail} onClose={onClose} />
        <Box sx={{ overflow: "auto", px: 2.5, py: 2.5 }}>
          <RunDetail detail={detail} isLoading={isLoadingDetail} timeline={timeline} />
        </Box>
      </Stack>
    </Drawer>
  );
}

function DrawerChrome({
  detailError,
  drawerWidth,
  isLoadingDetail,
  onClose
}: {
  readonly detailError: string | null;
  readonly drawerWidth: number;
  readonly isLoadingDetail: boolean;
  readonly onClose: () => void;
}) {
  return (
    <Stack alignItems="center" direction="row" justifyContent="space-between" px={1.5} py={1} spacing={1}>
      <Stack spacing={0.25}>
        <Typography variant="subtitle2">Run details</Typography>
        <Typography color="text.secondary" variant="body2">
          {isLoadingDetail ? "Loading selected run..." : "Inspect the selected run in a wider, resizable panel."}
        </Typography>
        {detailError === null ? null : (
          <Typography color="error" variant="caption">
            {detailError}
          </Typography>
        )}
      </Stack>
      <Stack alignItems="center" direction="row" spacing={0.75}>
        <Chip icon={<OpenInFullOutlinedIcon fontSize="small" />} label={`${drawerWidth.toString()} px`} size="small" variant="outlined" />
        <IconButton aria-label="Close detail drawer" onClick={onClose} size="small">
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}

function ResizeRail({
  onResize,
  width
}: {
  readonly onResize: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  readonly width: number;
}) {
  return (
    <ResizeRailShell>
      <ResizeHandleButton aria-label={`Resize drawer currently ${width.toString()} pixels wide`} onPointerDown={onResize}>
        <DragIndicatorOutlinedIcon fontSize="small" />
      </ResizeHandleButton>
    </ResizeRailShell>
  );
}

const ResizeRailShell = styled(Box)({
  bottom: 0,
  left: 0,
  pointerEvents: "none",
  position: "absolute",
  top: 0,
  width: 20,
  zIndex: 1
});

const ResizeHandleButton = styled(IconButton)(({ theme }) => ({
  "&:hover": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.08)
  },
  borderRadius: 0,
  cursor: "col-resize",
  height: "100%",
  inset: 0,
  justifyContent: "center",
  pointerEvents: "auto",
  position: "absolute",
  touchAction: "none",
  width: "100%"
}));
