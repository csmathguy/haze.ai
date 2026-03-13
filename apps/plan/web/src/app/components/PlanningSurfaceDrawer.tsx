import { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

const DESKTOP_DEFAULT_WIDTH = 640;
const DESKTOP_MIN_WIDTH = 440;
const DESKTOP_MAX_WIDTH = 980;
const MOBILE_DEFAULT_HEIGHT = 640;
const MOBILE_MIN_HEIGHT = 360;
const MOBILE_TOP_OFFSET = 24;

interface PlanningSurfaceDrawerProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly title: string;
}

export function PlanningSurfaceDrawer({
  children,
  description,
  onClose,
  open,
  title
}: PlanningSurfaceDrawerProps) {
  const { desktopWidth, isMobile, mobileHeight, setDragStart } = useResizableDrawerState(open);
  const theme = useTheme();

  return (
    <Drawer
      ModalProps={{ keepMounted: true }}
      anchor={isMobile ? "bottom" : "right"}
      onClose={onClose}
      open={open}
      slotProps={{
        paper: {
          sx: {
            borderBottomLeftRadius: isMobile ? 0 : 28,
            borderTopLeftRadius: 28,
            borderTopRightRadius: isMobile ? 28 : 0,
            height: isMobile ? mobileHeight : "100%",
            maxHeight: isMobile ? `calc(100vh - ${String(MOBILE_TOP_OFFSET)}px)` : "100vh",
            overflow: "hidden",
            width: isMobile ? "100%" : desktopWidth
          }
        }
      }}
    >
      <Stack sx={drawerFrameSx}>
        <DrawerResizeHandle
          desktopWidth={desktopWidth}
          isMobile={isMobile}
          mobileHeight={mobileHeight}
          setDragStart={setDragStart}
        />
        <Stack
          direction="row"
          justifyContent="space-between"
          spacing={2}
          sx={getDrawerHeaderSx(isMobile, theme.palette.text.primary)}
        >
          <Stack spacing={0.5}>
            <Typography variant="h3">{title}</Typography>
            <Typography color="text.secondary" variant="body2">
              {description}
            </Typography>
          </Stack>
          <IconButton aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        <Box sx={getDrawerBodySx(isMobile)}>{children}</Box>
      </Stack>
    </Drawer>
  );
}

function useResizableDrawerState(open: boolean) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [desktopWidth, setDesktopWidth] = useState(DESKTOP_DEFAULT_WIDTH);
  const [dragStart, setDragStart] = useState<{ pointer: number; size: number } | null>(null);
  const [mobileHeight, setMobileHeight] = useState(MOBILE_DEFAULT_HEIGHT);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const maxDesktopWidth = clamp(window.innerWidth - 64, DESKTOP_MIN_WIDTH, DESKTOP_MAX_WIDTH);
    const maxMobileHeight = Math.max(MOBILE_MIN_HEIGHT, window.innerHeight - MOBILE_TOP_OFFSET);

    setDesktopWidth((current) => clamp(current, DESKTOP_MIN_WIDTH, maxDesktopWidth));
    setMobileHeight((current) => {
      const nextValue = current === MOBILE_DEFAULT_HEIGHT ? Math.round(window.innerHeight * 0.82) : current;
      return clamp(nextValue, MOBILE_MIN_HEIGHT, maxMobileHeight);
    });
  }, [isMobile, open]);

  useEffect(() => {
    if (dragStart === null) {
      return;
    }

    const activeDragStart = dragStart;

    function handlePointerMove(event: PointerEvent): void {
      if (typeof window === "undefined") {
        return;
      }

      if (isMobile) {
        const maxHeight = Math.max(MOBILE_MIN_HEIGHT, window.innerHeight - MOBILE_TOP_OFFSET);
        const nextHeight = activeDragStart.size + (activeDragStart.pointer - event.clientY);
        setMobileHeight(clamp(nextHeight, MOBILE_MIN_HEIGHT, maxHeight));
        return;
      }

      const maxWidth = clamp(window.innerWidth - 64, DESKTOP_MIN_WIDTH, DESKTOP_MAX_WIDTH);
      const nextWidth = activeDragStart.size + (activeDragStart.pointer - event.clientX);
      setDesktopWidth(clamp(nextWidth, DESKTOP_MIN_WIDTH, maxWidth));
    }

    function handlePointerUp(): void {
      setDragStart(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragStart, isMobile]);

  return {
    desktopWidth,
    isMobile,
    mobileHeight,
    setDragStart,
  };
}

function DrawerResizeHandle({
  desktopWidth,
  isMobile,
  mobileHeight,
  setDragStart
}: {
  readonly desktopWidth: number;
  readonly isMobile: boolean;
  readonly mobileHeight: number;
  readonly setDragStart: (value: { pointer: number; size: number } | null) => void;
}) {
  const theme = useTheme();

  if (isMobile) {
    return (
      <Box
        aria-label="Resize drawer"
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          setDragStart({
            pointer: event.clientY,
            size: mobileHeight
          });
        }}
        role="presentation"
        sx={mobileResizeHandleSx}
      >
        <Box sx={getMobileResizePillSx(theme.palette.text.primary)} />
      </Box>
    );
  }

  return (
    <Box
      aria-label="Resize drawer"
      onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
        setDragStart({
          pointer: event.clientX,
          size: desktopWidth
        });
      }}
      role="presentation"
      sx={desktopResizeHandleSx}
    >
      <Box sx={getDesktopResizeRailSx(theme.palette.text.primary)} />
    </Box>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const drawerFrameSx = {
  height: "100%"
} as const;

const mobileResizeHandleSx = {
  alignItems: "center",
  cursor: "ns-resize",
  display: "flex",
  justifyContent: "center",
  paddingBottom: 10,
  paddingTop: 12
} as const;

const desktopResizeHandleSx = {
  bottom: 0,
  cursor: "ew-resize",
  left: 0,
  position: "absolute",
  top: 0,
  width: 16
} as const;

function getMobileResizePillSx(textPrimary: string) {
  return {
    backgroundColor: alpha(textPrimary, 0.18),
    borderRadius: 999,
    height: 6,
    width: 64
  } as const;
}

function getDesktopResizeRailSx(textPrimary: string) {
  return {
    backgroundColor: alpha(textPrimary, 0.12),
    borderRadius: 999,
    height: 88,
    left: 6,
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 4
  } as const;
}

function getDrawerHeaderSx(isMobile: boolean, textPrimary: string) {
  return {
    alignItems: "start",
    borderBottom: `1px solid ${alpha(textPrimary, 0.08)}`,
    paddingBottom: 16,
    paddingLeft: isMobile ? 24 : 32,
    paddingRight: 16,
    paddingTop: isMobile ? 0 : 24
  } as const;
}

function getDrawerBodySx(isMobile: boolean) {
  return {
    flex: 1,
    overflowY: "auto",
    paddingBottom: 24,
    paddingLeft: isMobile ? 24 : 32,
    paddingRight: 24,
    paddingTop: 24
  } as const;
}
