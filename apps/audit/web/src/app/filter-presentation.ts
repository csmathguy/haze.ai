import type { AuditRunFilters } from "./api.js";

export interface ActiveFilterSummary {
  key: keyof AuditRunFilters;
  label: string;
  value: string;
}

const FILTER_LABELS: Record<keyof AuditRunFilters, string> = {
  agentName: "Agent",
  project: "Project",
  status: "Status",
  workflow: "Workflow",
  workItemId: "Work item",
  worktreePath: "Worktree"
};

const FILTER_KEYS = Object.keys(FILTER_LABELS) as (keyof AuditRunFilters)[];

export function countActiveFilters(filters: AuditRunFilters): number {
  return buildActiveFilterSummaries(filters).length;
}

export function buildActiveFilterSummaries(filters: AuditRunFilters): ActiveFilterSummary[] {
  return FILTER_KEYS.flatMap((key) => {
    const value = filters[key].trim();

    return value.length === 0
      ? []
      : [
          {
            key,
            label: FILTER_LABELS[key],
            value
          }
        ];
  });
}

export function clearAuditRunFilters(): AuditRunFilters {
  return {
    agentName: "",
    project: "",
    status: "",
    workflow: "",
    workItemId: "",
    worktreePath: ""
  };
}
