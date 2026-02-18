import { useCallback, useEffect, useState } from "react";

export type AppView = "dashboard" | "kanban" | "projects";

const resolveViewFromLocation = (): AppView => {
  if (typeof window === "undefined") {
    return "dashboard";
  }

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "kanban" || view === "projects") {
    return view;
  }
  return "dashboard";
};

const syncViewToLocation = (view: AppView): void => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get("view") === view) {
    return;
  }

  url.searchParams.set("view", view);
  window.history.pushState({ view }, "", `${url.pathname}${url.search}${url.hash}`);
};

export function useAppView(): {
  activeView: AppView;
  navigateToView: (view: AppView) => void;
} {
  const [activeView, setActiveView] = useState<AppView>(() => resolveViewFromLocation());

  useEffect(() => {
    const onPopState = () => {
      setActiveView(resolveViewFromLocation());
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigateToView = useCallback((nextView: AppView) => {
    setActiveView(nextView);
    syncViewToLocation(nextView);
  }, []);

  return {
    activeView,
    navigateToView
  };
}
