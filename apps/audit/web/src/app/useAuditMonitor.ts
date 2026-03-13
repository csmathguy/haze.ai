import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from "react";

import type { AuditRunDetail, AuditRunOverview } from "@taxes/shared";

import type { AuditRunFilters } from "./api.js";
import { fetchAuditRunDetail, fetchAuditRuns, subscribeToAuditStream } from "./api.js";

export type ConnectionState = "connecting" | "live" | "offline";

export interface RunStats {
  executionCount: number;
  failedRuns: number;
  runningRuns: number;
  totalRuns: number;
}

export interface UseAuditMonitorResult {
  connectionState: ConnectionState;
  detail: AuditRunDetail | null;
  detailError: string | null;
  filters: AuditRunFilters;
  isLoadingDetail: boolean;
  isLoadingRuns: boolean;
  lastEventAt: string | null;
  runError: string | null;
  runStats: RunStats;
  runs: AuditRunOverview[];
  selectedRunId: string | null;
  setFilters: (filters: AuditRunFilters) => void;
  setSelectedRunId: (runId: string | null) => void;
  workflows: string[];
  worktreePaths: string[];
}

const initialFilters: AuditRunFilters = {
  status: "",
  workflow: "",
  worktreePath: ""
};

export function useAuditMonitor(): UseAuditMonitorResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [filters, setFilters] = useState<AuditRunFilters>(initialFilters);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const runsState = useRunData(filters, setLastEventAt, setSelectedRunId);
  const deferredRuns = useDeferredValue(runsState.runs);
  const detailState = useDetailData(selectedRunId);

  useAuditStream({
    filters,
    onConnectionStateChange: setConnectionState,
    onEventTimestamp: setLastEventAt,
    onRefreshDetail: detailState.refreshDetail,
    onRefreshRuns: runsState.refreshRuns,
    selectedRunId
  });

  return {
    connectionState,
    detail: detailState.detail,
    detailError: detailState.detailError,
    filters,
    isLoadingDetail: detailState.isLoadingDetail,
    isLoadingRuns: runsState.isLoadingRuns,
    lastEventAt,
    runError: runsState.runError,
    runStats: summarizeRuns(deferredRuns),
    runs: deferredRuns,
    selectedRunId,
    setFilters,
    setSelectedRunId,
    workflows: deriveWorkflows(runsState.runs),
    worktreePaths: deriveWorktreePaths(runsState.runs)
  };
}

function useRunData(
  filters: AuditRunFilters,
  setLastEventAt: (value: string | null) => void,
  setSelectedRunId: (value: string | null | ((current: string | null) => string | null)) => void
) {
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [runError, setRunError] = useState<string | null>(null);
  const [runs, setRuns] = useState<AuditRunOverview[]>([]);

  const refreshRuns = useEffectEvent(async (nextFilters: AuditRunFilters) => {
    setIsLoadingRuns(true);
    setRunError(null);

    try {
      const loadedRuns = await fetchAuditRuns(nextFilters);

      setRuns(loadedRuns);
      setSelectedRunId((currentSelectedRunId) => selectRunId(currentSelectedRunId, loadedRuns));
      if (loadedRuns[0]?.latestEventAt !== undefined) {
        setLastEventAt(loadedRuns[0].latestEventAt);
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Failed to load runs.");
    } finally {
      setIsLoadingRuns(false);
    }
  });

  useEffect(() => {
    void refreshRuns(filters);
  }, [filters, refreshRuns]);

  return {
    isLoadingRuns,
    refreshRuns,
    runError,
    runs
  };
}

function useDetailData(selectedRunId: string | null) {
  const [detail, setDetail] = useState<AuditRunDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const refreshDetail = useEffectEvent(async (runId: string | null) => {
    if (runId === null) {
      setDetail(null);
      return;
    }

    setIsLoadingDetail(true);
    setDetailError(null);

    try {
      setDetail(await fetchAuditRunDetail(runId));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Failed to load run detail.");
    } finally {
      setIsLoadingDetail(false);
    }
  });

  useEffect(() => {
    void refreshDetail(selectedRunId);
  }, [refreshDetail, selectedRunId]);

  return {
    detail,
    detailError,
    isLoadingDetail,
    refreshDetail
  };
}

function useAuditStream(input: {
  filters: AuditRunFilters;
  onConnectionStateChange: (state: ConnectionState) => void;
  onEventTimestamp: (timestamp: string) => void;
  onRefreshDetail: (runId: string | null) => Promise<void>;
  onRefreshRuns: (filters: AuditRunFilters) => Promise<void>;
  selectedRunId: string | null;
}) {
  const handleStreamEvent = useEffectEvent((eventTimestamp: string, runId: string) => {
    input.onConnectionStateChange("live");
    input.onEventTimestamp(eventTimestamp);
    startTransition(() => {
      void input.onRefreshRuns(input.filters);
      if (input.selectedRunId === runId) {
        void input.onRefreshDetail(runId);
      }
    });
  });

  useEffect(() => {
    input.onConnectionStateChange("connecting");

    return subscribeToAuditStream({
      onError: () => {
        input.onConnectionStateChange("offline");
      },
      onEvent: (event) => {
        handleStreamEvent(event.timestamp, event.runId);
      },
      onReady: (since) => {
        input.onConnectionStateChange("live");
        input.onEventTimestamp(since);
      }
    });
  }, [handleStreamEvent, input]);
}

function deriveWorkflows(runs: AuditRunOverview[]): string[] {
  return Array.from(new Set(runs.map((run) => run.workflow))).sort((left, right) => left.localeCompare(right));
}

function deriveWorktreePaths(runs: AuditRunOverview[]): string[] {
  return Array.from(new Set(runs.map((run) => run.worktreePath))).sort((left, right) => left.localeCompare(right));
}

function selectRunId(currentSelectedRunId: string | null, runs: AuditRunOverview[]): string | null {
  if (currentSelectedRunId !== null && runs.some((run) => run.runId === currentSelectedRunId)) {
    return currentSelectedRunId;
  }

  return runs[0]?.runId ?? null;
}

function summarizeRuns(runs: AuditRunOverview[]): RunStats {
  return runs.reduce(
    (summary, run) => ({
      executionCount: summary.executionCount + run.executionCount,
      failedRuns: summary.failedRuns + (run.status === "failed" ? 1 : 0),
      runningRuns: summary.runningRuns + (run.status === "running" ? 1 : 0),
      totalRuns: summary.totalRuns + 1
    }),
    {
      executionCount: 0,
      failedRuns: 0,
      runningRuns: 0,
      totalRuns: 0
    }
  );
}
