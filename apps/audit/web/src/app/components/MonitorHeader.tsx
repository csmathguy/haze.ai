import { useState } from "react";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import CableOutlinedIcon from "@mui/icons-material/CableOutlined";
import { Box, Button, Chip, Collapse, Paper, Stack, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

import type { AuditRunFilters } from "../api.js";
import { buildActiveFilterSummaries, clearAuditRunFilters, countActiveFilters } from "../filter-presentation.js";
import { formatDateTime, formatRelativePath } from "../time.js";
import type { ConnectionState } from "../useAuditMonitor.js";
import { FiltersBar } from "./FiltersBar.js";

interface MonitorHeaderProps {
  readonly agentNames: string[];
  readonly connectionState: ConnectionState;
  readonly filters: AuditRunFilters;
  readonly lastEventAt: string | null;
  readonly onFilterChange: (filters: AuditRunFilters) => void;
  readonly projects: string[];
  readonly visibleRunCount: number;
  readonly workflows: string[];
  readonly workItemIds: string[];
  readonly worktreePaths: string[];
}

const HeaderShell = styled(Paper)(({ theme }) => ({
  background: `
    radial-gradient(circle at top left, ${alpha(theme.palette.secondary.main, 0.13)}, transparent 33%),
    linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.94)} 100%)
  `,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.2,
  padding: theme.spacing(2.5)
}));

const ActiveFilterChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.secondary.main, 0.12),
  borderColor: alpha(theme.palette.secondary.main, 0.22),
  justifyContent: "flex-start"
}));

export function MonitorHeader(props: MonitorHeaderProps) {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const activeFilters = buildActiveFilterSummaries(props.filters);
  const activeFilterCount = countActiveFilters(props.filters);

  return (
    <HeaderShell elevation={0}>
      <Stack spacing={2}>
        <Stack
          alignItems={{ md: "flex-start", xs: "stretch" }}
          direction={{ md: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={1}>
            <Typography color="text.secondary" variant="subtitle2">
              Shared audit workspace
            </Typography>
            <Typography variant="h1">Audit monitor</Typography>
            <Typography color="text.secondary" maxWidth={760} variant="body2">
              Review runs, execution history, and linked planning lineage without leaving the current audit surface.
            </Typography>
            <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
              <Chip icon={<HubOutlinedIcon fontSize="small" />} label={`${props.visibleRunCount.toString()} visible runs`} size="small" variant="outlined" />
              <Chip
                color={toConnectionColor(props.connectionState)}
                icon={<CableOutlinedIcon fontSize="small" />}
                label={buildConnectionLabel(props.connectionState, props.lastEventAt)}
                size="small"
                variant="filled"
              />
            </Stack>
          </Stack>
          <Stack alignItems={{ md: "flex-end", xs: "stretch" }} spacing={1}>
            <Button
              onClick={() => {
                setIsFilterPanelOpen((currentValue) => !currentValue);
              }}
              startIcon={isFilterPanelOpen ? <FilterAltOffOutlinedIcon /> : <FilterAltOutlinedIcon />}
              variant={activeFilterCount > 0 ? "contained" : "outlined"}
            >
              {isFilterPanelOpen ? "Hide filters" : "Show filters"}
              {activeFilterCount === 0 ? "" : ` (${activeFilterCount.toString()})`}
            </Button>
            {activeFilterCount === 0 ? (
              <Typography color="text.secondary" textAlign={{ md: "right", xs: "left" }} variant="body2">
                Filters apply to the runs list, summary metrics, and linked work-item view.
              </Typography>
            ) : null}
          </Stack>
        </Stack>
        {!isFilterPanelOpen && activeFilters.length > 0 ? <CollapsedFilterSummary activeFilters={activeFilters} /> : null}
        <Collapse in={isFilterPanelOpen}>
          <Box sx={{ pt: 0.5 }}>
            <FiltersBar
              activeFilters={activeFilters}
              agentNames={props.agentNames}
              filters={props.filters}
              onChange={props.onFilterChange}
              onClear={() => {
                props.onFilterChange(clearAuditRunFilters());
              }}
              projects={props.projects}
              workflows={props.workflows}
              workItemIds={props.workItemIds}
              worktreePaths={props.worktreePaths}
            />
          </Box>
        </Collapse>
      </Stack>
    </HeaderShell>
  );
}

function CollapsedFilterSummary({
  activeFilters
}: {
  readonly activeFilters: ReturnType<typeof buildActiveFilterSummaries>;
}) {
  return (
    <Stack spacing={0.75}>
      <Typography color="text.secondary" variant="subtitle2">
        Active filters
      </Typography>
      <Stack direction="row" flexWrap="wrap" spacing={0.75} useFlexGap>
        {activeFilters.map((filter) => (
          <ActiveFilterChip
            key={filter.key}
            label={`${filter.label}: ${formatFilterValue(filter.key, filter.value)}`}
            size="small"
            variant="outlined"
          />
        ))}
      </Stack>
    </Stack>
  );
}

function formatFilterValue(key: keyof AuditRunFilters, value: string): string {
  return key === "worktreePath" ? formatRelativePath(value) : value;
}

function toConnectionColor(state: ConnectionState): "default" | "error" | "success" | "warning" {
  switch (state) {
    case "connecting":
      return "warning";
    case "live":
      return "success";
    case "offline":
      return "error";
  }
}

function buildConnectionLabel(state: ConnectionState, lastEventAt: string | null): string {
  switch (state) {
    case "connecting":
      return "Connecting to live stream";
    case "live":
      return lastEventAt === null ? "Live stream connected" : `Live since ${formatDateTime(lastEventAt)}`;
    case "offline":
      return "Stream offline";
  }
}
