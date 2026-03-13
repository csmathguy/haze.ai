import { FormControl, InputLabel, MenuItem, Paper, Select, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";

import type { AuditRunFilters } from "../api.js";
import { formatRelativePath } from "../time.js";

interface FiltersBarProps {
  readonly agentNames: string[];
  readonly filters: AuditRunFilters;
  readonly onChange: (next: AuditRunFilters) => void;
  readonly projects: string[];
  readonly workItemIds: string[];
  readonly workflows: string[];
  readonly worktreePaths: string[];
}

const FilterShell = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2)
}));

export function FiltersBar(props: FiltersBarProps) {
  return (
    <FilterShell elevation={0}>
      <Stack direction={{ md: "row", xs: "column" }} flexWrap="wrap" spacing={2} useFlexGap>
        <StatusFilterField filters={props.filters} onChange={props.onChange} />
        <ProjectFilterField filters={props.filters} onChange={props.onChange} projects={props.projects} />
        <AgentFilterField agentNames={props.agentNames} filters={props.filters} onChange={props.onChange} />
        <WorkflowFilterField filters={props.filters} onChange={props.onChange} workflows={props.workflows} />
        <WorkItemFilterField filters={props.filters} onChange={props.onChange} workItemIds={props.workItemIds} />
        <WorktreeFilterField filters={props.filters} onChange={props.onChange} worktreePaths={props.worktreePaths} />
      </Stack>
    </FilterShell>
  );
}

function StatusFilterField({ filters, onChange }: Pick<FiltersBarProps, "filters" | "onChange">) {
  return (
    <FilterField
      label="Status"
      onChange={(status) => {
        onChange({
          ...filters,
          status
        });
      }}
      options={[
        { label: "All statuses", value: "" },
        { label: "Running", value: "running" },
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" }
      ]}
      value={filters.status}
    />
  );
}

function ProjectFilterField({
  filters,
  onChange,
  projects
}: Pick<FiltersBarProps, "filters" | "onChange" | "projects">) {
  return (
    <FilterField
      label="Project"
      onChange={(project) => {
        onChange({
          ...filters,
          project
        });
      }}
      options={buildStringOptions("All projects", projects)}
      value={filters.project}
    />
  );
}

function AgentFilterField({
  agentNames,
  filters,
  onChange
}: Pick<FiltersBarProps, "agentNames" | "filters" | "onChange">) {
  return (
    <FilterField
      label="Agent"
      onChange={(agentName) => {
        onChange({
          ...filters,
          agentName
        });
      }}
      options={buildStringOptions("All agents", agentNames)}
      value={filters.agentName}
    />
  );
}

function WorkflowFilterField({
  filters,
  onChange,
  workflows
}: Pick<FiltersBarProps, "filters" | "onChange" | "workflows">) {
  return (
    <FilterField
      label="Workflow"
      onChange={(workflow) => {
        onChange({
          ...filters,
          workflow
        });
      }}
      options={buildStringOptions("All workflows", workflows)}
      value={filters.workflow}
    />
  );
}

function WorkItemFilterField({
  filters,
  onChange,
  workItemIds
}: Pick<FiltersBarProps, "filters" | "onChange" | "workItemIds">) {
  return (
    <FilterField
      label="Work item"
      onChange={(workItemId) => {
        onChange({
          ...filters,
          workItemId
        });
      }}
      options={buildStringOptions("All work items", workItemIds)}
      value={filters.workItemId}
    />
  );
}

function WorktreeFilterField({
  filters,
  onChange,
  worktreePaths
}: Pick<FiltersBarProps, "filters" | "onChange" | "worktreePaths">) {
  return (
    <FilterField
      label="Worktree"
      onChange={(worktreePath) => {
        onChange({
          ...filters,
          worktreePath
        });
      }}
      options={[
        { label: "All worktrees", value: "" },
        ...worktreePaths.map((worktreePath) => ({
          label: formatRelativePath(worktreePath),
          value: worktreePath
        }))
      ]}
      value={filters.worktreePath}
    />
  );
}

function buildStringOptions(allLabel: string, values: string[]) {
  return [
    { label: allLabel, value: "" },
    ...values.map((value) => ({
      label: value,
      value
    }))
  ];
}

function FilterField({
  label,
  onChange,
  options,
  value
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: { label: string; value: string }[];
  readonly value: string;
}) {
  return (
    <FormControl fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={value}
      >
        {options.map((option) => (
          <MenuItem key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
