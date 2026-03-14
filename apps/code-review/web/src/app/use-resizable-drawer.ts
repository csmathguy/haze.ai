import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from "react";

const DEFAULT_DRAWER_WIDTH = 860;
const MIN_DRAWER_WIDTH = 640;
const VIEWPORT_MARGIN = 220;

interface DrawerResizeRefs {
  readonly animationFrameIdRef: RefObject<number | null>;
  readonly latestWidthRef: RefObject<number>;
  readonly pointerIdRef: RefObject<number | null>;
  readonly resizeHandleRef: RefObject<HTMLButtonElement | null>;
  readonly resizeStartWidthRef: RefObject<number>;
  readonly resizeStartXRef: RefObject<number>;
  readonly stopResizeRef: RefObject<(() => void) | null>;
}

export function useResizableDrawer(isDesktop: boolean) {
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const animationFrameIdRef = useRef<number | null>(null);
  const latestWidthRef = useRef(DEFAULT_DRAWER_WIDTH);
  const pointerIdRef = useRef<number | null>(null);
  const resizeHandleRef = useRef<HTMLButtonElement | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_DRAWER_WIDTH);
  const stopResizeRef = useRef<(() => void) | null>(null);

  const stopResize = useEffectEvent(() => {
    stopResizeRef.current?.();
  });
  const resizeRefs: DrawerResizeRefs = {
    animationFrameIdRef,
    latestWidthRef,
    pointerIdRef,
    resizeHandleRef,
    resizeStartWidthRef,
    resizeStartXRef,
    stopResizeRef
  };

  useEffect(() => {
    latestWidthRef.current = drawerWidth;
  }, [drawerWidth]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const handleWindowResize = () => {
      setDrawerWidth((currentWidth) => clampDrawerWidth(currentWidth));
    };

    handleWindowResize();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      stopResize();
    };
  }, [isDesktop, stopResize]);

  useEffect(() => {
    return () => {
      clearScheduledResizeFrame(animationFrameIdRef);
    };
  }, []);

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isDesktop || event.button !== 0) {
      return;
    }

    event.preventDefault();
    stopResizeRef.current = createResizeSession(event, drawerWidth, resizeRefs, setDrawerWidth);
  }

  return {
    drawerWidth,
    startResize
  };
}

function clampDrawerWidth(width: number): number {
  if (typeof window === "undefined") {
    return width;
  }

  const maxWidth = Math.max(MIN_DRAWER_WIDTH, window.innerWidth - VIEWPORT_MARGIN);
  return Math.max(MIN_DRAWER_WIDTH, Math.min(maxWidth, width));
}

function clearScheduledResizeFrame(animationFrameIdRef: RefObject<number | null>): void {
  if (animationFrameIdRef.current === null) {
    return;
  }

  window.cancelAnimationFrame(animationFrameIdRef.current);
  animationFrameIdRef.current = null;
}

function flushResizeWidth(refs: DrawerResizeRefs, setDrawerWidth: Dispatch<SetStateAction<number>>): void {
  clearScheduledResizeFrame(refs.animationFrameIdRef);
  setDrawerWidth(refs.latestWidthRef.current);
}

function createResizeSession(
  event: ReactPointerEvent<HTMLButtonElement>,
  drawerWidth: number,
  refs: DrawerResizeRefs,
  setDrawerWidth: Dispatch<SetStateAction<number>>
): () => void {
  const resizeHandle = event.currentTarget;

  refs.resizeHandleRef.current = resizeHandle;
  refs.pointerIdRef.current = event.pointerId;
  refs.resizeStartXRef.current = event.clientX;
  refs.resizeStartWidthRef.current = drawerWidth;
  refs.latestWidthRef.current = drawerWidth;

  resizeHandle.setPointerCapture(event.pointerId);
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  const scheduleResizeWidth = () => {
    if (refs.animationFrameIdRef.current !== null) {
      return;
    }

    refs.animationFrameIdRef.current = window.requestAnimationFrame(() => {
      flushResizeWidth(refs, setDrawerWidth);
    });
  };
  const handlePointerMove = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== refs.pointerIdRef.current) {
      return;
    }

    refs.latestWidthRef.current = clampDrawerWidth(refs.resizeStartWidthRef.current + (refs.resizeStartXRef.current - moveEvent.clientX));
    scheduleResizeWidth();
  };
  const handlePointerEnd = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== refs.pointerIdRef.current) {
      return;
    }

    refs.stopResizeRef.current?.();
  };
  const handleWindowBlur = () => {
    refs.stopResizeRef.current?.();
  };

  resizeHandle.addEventListener("pointermove", handlePointerMove);
  resizeHandle.addEventListener("pointerup", handlePointerEnd);
  resizeHandle.addEventListener("pointercancel", handlePointerEnd);
  resizeHandle.addEventListener("lostpointercapture", handlePointerEnd);
  window.addEventListener("blur", handleWindowBlur);

  return () => {
    resizeHandle.removeEventListener("pointermove", handlePointerMove);
    resizeHandle.removeEventListener("pointerup", handlePointerEnd);
    resizeHandle.removeEventListener("pointercancel", handlePointerEnd);
    resizeHandle.removeEventListener("lostpointercapture", handlePointerEnd);
    window.removeEventListener("blur", handleWindowBlur);

    flushResizeWidth(refs, setDrawerWidth);

    if (
      refs.resizeHandleRef.current !== null &&
      refs.pointerIdRef.current !== null &&
      refs.resizeHandleRef.current.hasPointerCapture(refs.pointerIdRef.current)
    ) {
      refs.resizeHandleRef.current.releasePointerCapture(refs.pointerIdRef.current);
    }

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    refs.pointerIdRef.current = null;
    refs.resizeHandleRef.current = null;
    refs.stopResizeRef.current = null;
  };
}
