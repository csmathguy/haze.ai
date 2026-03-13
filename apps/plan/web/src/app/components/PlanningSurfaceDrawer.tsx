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
import { alpha, styled, useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

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
      <DrawerFrame>
        <DrawerResizeHandle
          desktopWidth={desktopWidth}
          isMobile={isMobile}
          mobileHeight={mobileHeight}
          setDragStart={setDragStart}
        />
        <DrawerHeader
          direction="row"
          ismobile={isMobile ? 1 : 0}
          justifyContent="space-between"
          spacing={2}
          sx={{ borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.08)}` }}
        >
          <Stack spacing={0.5}>
            <Typography variant="h2">{title}</Typography>
            <Typography color="text.secondary">{description}</Typography>
          </Stack>
          <IconButton aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </DrawerHeader>
        <DrawerBody ismobile={isMobile ? 1 : 0}>{children}</DrawerBody>
      </DrawerFrame>
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
      <MobileResizeHandle
        aria-label="Resize drawer"
        onPointerDown={(event) => {
          setDragStart({
            pointer: event.clientY,
            size: mobileHeight
          });
        }}
        role="presentation"
      >
        <MobileResizePill sx={{ backgroundColor: alpha(theme.palette.text.primary, 0.18) }} />
      </MobileResizeHandle>
    );
  }

  return (
    <DesktopResizeHandle
      aria-label="Resize drawer"
      onPointerDown={(event) => {
        setDragStart({
          pointer: event.clientX,
          size: desktopWidth
        });
      }}
      role="presentation"
    >
      <DesktopResizeRail sx={{ backgroundColor: alpha(theme.palette.text.primary, 0.12) }} />
    </DesktopResizeHandle>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const DrawerFrame = styled(Stack)({
  height: "100%"
});

const MobileResizeHandle = styled(Box)({
  alignItems: "center",
  cursor: "ns-resize",
  display: "flex",
  justifyContent: "center",
  paddingBottom: 10,
  paddingTop: 12
});

const MobileResizePill = styled(Box)({
  borderRadius: 999,
  height: 6,
  width: 64
});

const DesktopResizeHandle = styled(Box)({
  bottom: 0,
  cursor: "ew-resize",
  left: 0,
  position: "absolute",
  top: 0,
  width: 16
});

const DesktopResizeRail = styled(Box)({
  borderRadius: 999,
  height: 88,
  left: 6,
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 4
});

const DrawerHeader = styled(Stack, {
  shouldForwardProp: (prop) => prop !== "ismobile"
})<{ readonly ismobile: 0 | 1 }>(({ ismobile }) => ({
  alignItems: "start",
  paddingBottom: 16,
  paddingLeft: ismobile ? 24 : 32,
  paddingRight: 16,
  paddingTop: ismobile ? 0 : 24
}));

const DrawerBody = styled(Box, {
  shouldForwardProp: (prop) => prop !== "ismobile"
})<{ readonly ismobile: 0 | 1 }>(({ ismobile }) => ({
  flex: 1,
  overflowY: "auto",
  paddingBottom: 24,
  paddingLeft: ismobile ? 24 : 32,
  paddingRight: 24,
  paddingTop: 24
}));
