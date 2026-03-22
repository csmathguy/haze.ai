import React from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Visibility as VisibilityIcon } from "@mui/icons-material";
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowParams
} from "@mui/x-data-grid";

import type { RunSummary } from "../api.js";

export interface RunSummaryGridProps {
  approvingApprovalId: string | null;
  cancelingRunId: string | null;
  emptyState: string;
  onApproveRun: (approvalId: string) => void;
  onCancelRun: (runId: string) => void;
  onViewRun: (runId: string) => void;
  runs: RunSummary[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getStatusColor(status: string): "success" | "warning" | "error" | "info" {
  switch (status.toLowerCase()) {
    case "completed":
      return "success";
    case "running":
      return "info";
    case "waiting":
      return "warning";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "info";
  }
}

function formatStartedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours.toString()}h ${(minutes % 60).toString()}m`;
  }

  if (minutes > 0) {
    return `${minutes.toString()}m ${(seconds % 60).toString()}s`;
  }

  return `${seconds.toString()}s`;
}

function renderWorkItemCell(params: GridRenderCellParams<RunSummary, string | null>): React.ReactNode {
  return (
    <Typography sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}>
      {params.value ?? "-"}
    </Typography>
  );
}

function renderStatusCell(params: GridRenderCellParams<RunSummary, string>): React.ReactNode {
  const status = params.value ?? "unknown";
  return <Chip label={status} size="small" color={getStatusColor(status)} />;
}

function renderCurrentStepCell(params: GridRenderCellParams<RunSummary, string | null>): React.ReactNode {
  return (
    <Typography sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
      {params.value ?? "-"}
    </Typography>
  );
}

function renderElapsedCell(params: GridRenderCellParams<RunSummary, number>): React.ReactNode {
  return (
    <Box>
      <Typography sx={{ fontSize: "0.875rem" }}>{formatElapsedTime(params.value ?? 0)}</Typography>
      {params.row.isStalled ? (
        <Typography color="error" variant="caption">
          Stalled (5+ min waiting)
        </Typography>
      ) : null}
    </Box>
  );
}

function buildActionColumn(input: Omit<RunSummaryGridProps, "emptyState" | "runs">): GridColDef<RunSummary> {
  return {
    field: "actions",
    getActions: (params) => {
      const run = params.row;
      const actions = [
        <GridActionsCellItem
          key="view"
          icon={<VisibilityIcon fontSize="small" />}
          label="View"
          onClick={() => { input.onViewRun(run.id); }}
          showInMenu={false}
        />
      ];

      if (run.pendingApprovalId) {
        actions.unshift(
          <GridActionsCellItem
            key="approve"
            icon={<CheckCircleIcon fontSize="small" />}
            label={input.approvingApprovalId === run.pendingApprovalId ? "Approving..." : "Approve"}
            onClick={() => { if (run.pendingApprovalId) { input.onApproveRun(run.pendingApprovalId); } }}
            showInMenu={false}
          />
        );
      }

      if (run.status === "running" || run.status === "waiting") {
        actions.unshift(
          <GridActionsCellItem
            key="cancel"
            icon={<CancelIcon fontSize="small" />}
            label={input.cancelingRunId === run.id ? "Cancelling..." : "Cancel"}
            onClick={() => { input.onCancelRun(run.id); }}
            showInMenu={false}
          />
        );
      }

      return actions;
    },
    headerName: "Actions",
    minWidth: 150,
    type: "actions"
  };
}

function buildColumns(input: Omit<RunSummaryGridProps, "emptyState" | "runs">): GridColDef<RunSummary>[] {
  return [
    {
      field: "definitionName",
      flex: 1.1,
      headerName: "Definition",
      minWidth: 180
    },
    {
      field: "workItemId",
      headerName: "Work Item",
      minWidth: 140,
      renderCell: renderWorkItemCell
    },
    {
      field: "startedAt",
      headerName: "Started",
      minWidth: 170,
      sortComparator: (left, right) => new Date(String(left)).getTime() - new Date(String(right)).getTime(),
      valueFormatter: (value) => formatStartedAt(String(value))
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 130,
      renderCell: renderStatusCell
    },
    {
      field: "currentStep",
      flex: 1,
      headerName: "Current Step",
      minWidth: 180,
      renderCell: renderCurrentStepCell
    },
    {
      field: "elapsedMs",
      headerName: "Elapsed",
      minWidth: 140,
      renderCell: renderElapsedCell
    },
    buildActionColumn(input)
  ];
}

const NoRowsOverlay: React.FC<{ message: string }> = ({ message }) => (
  <Stack sx={{ alignItems: "center", height: "100%", justifyContent: "center", p: 3 }}>
    <Typography color="text.secondary">{message}</Typography>
  </Stack>
);

export const RunSummaryGrid: React.FC<RunSummaryGridProps> = ({
  approvingApprovalId,
  cancelingRunId,
  emptyState,
  onApproveRun,
  onCancelRun,
  onViewRun,
  runs
}) => (
  <Box sx={{ width: "100%" }}>
    <DataGrid
      autoHeight
      columns={buildColumns({
        approvingApprovalId,
        cancelingRunId,
        onApproveRun,
        onCancelRun,
        onViewRun
      })}
      density="compact"
      disableRowSelectionOnClick
      initialState={{
        pagination: {
          paginationModel: {
            page: 0,
            pageSize: 10
          }
        },
        sorting: {
          sortModel: [
            {
              field: "startedAt",
              sort: "desc"
            }
          ]
        }
      }}
      pageSizeOptions={DEFAULT_PAGE_SIZE_OPTIONS}
      rows={runs}
      showToolbar
      slots={{
        noRowsOverlay: () => <NoRowsOverlay message={emptyState} />
      }}
      slotProps={{
        toolbar: {
          printOptions: {
            disableToolbarButton: true
          },
          showQuickFilter: true
        }
      }}
      sx={{
        border: 0,
        "& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus": {
          outline: "none"
        },
        "& .MuiDataGrid-row": {
          cursor: "pointer"
        }
      }}
      onRowClick={(params: GridRowParams<RunSummary>) => { onViewRun(params.row.id); }}
    />
  </Box>
);

export const RunSummaryActions: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
    {children}
  </Stack>
);

export const RunSummaryActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
}> = ({ children, onClick }) => (
  <Button onClick={onClick} variant="outlined">
    {children}
  </Button>
);
