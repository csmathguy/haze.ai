import { FormControl, InputLabel, MenuItem, Paper, Select, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";

import type { AuditRunFilters } from "../api.js";
import { formatRelativePath } from "../time.js";

interface FiltersBarProps {
  readonly filters: AuditRunFilters;
  readonly onChange: (next: AuditRunFilters) => void;
  readonly worktreePaths: string[];
  readonly workflows: string[];
}

const FilterShell = styled(Paper)(({ theme }) => ({
  border: `1px solid var(--mui-palette-divider)`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2)
}));

export function FiltersBar({ filters, onChange, worktreePaths, workflows }: FiltersBarProps) {
  return (
    <FilterShell elevation={0}>
      <Stack direction={{ md: "row", xs: "column" }} spacing={2}>
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
        <FilterField
          label="Workflow"
          onChange={(workflow) => {
            onChange({
              ...filters,
              workflow
            });
          }}
          options={[
            { label: "All workflows", value: "" },
            ...workflows.map((workflow) => ({
              label: workflow,
              value: workflow
            }))
          ]}
          value={filters.workflow}
        />
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
      </Stack>
    </FilterShell>
  );
}

interface FilterFieldProps {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: { label: string; value: string }[];
  readonly value: string;
}

function FilterField({ label, onChange, options, value }: FilterFieldProps) {
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
